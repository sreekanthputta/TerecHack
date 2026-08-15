import { nanoid } from "nanoid";
import {
  AgentContextSchema,
  DecisionRecordSchema,
  type AgentContext,
  type DecisionRecord,
  type TeracAsk,
  type TeracRawResponse,
  type TraceEventInput,
} from "@autobiz/shared";

import { makeOrchClient, type OrchClient } from "./orch.js";
import { extractTriggerEvent, beforeFromTrigger, topicFromTrigger, type TriggerEvent } from "./trigger.js";
import { formulateAsk } from "./formulate.js";
import { postAsk, pollResult } from "./terac.js";
import { aggregateResponses } from "./aggregate.js";
import { decisionMemoryPath, renderDecisionMarkdown } from "./memory.js";
import { loadCannedResponse, stageDelay } from "./fixture.js";
import { shouldDedup } from "./dedup.js";
import { shouldNotifyOwner, notifyOwner } from "./notify.js";
import { derivePlanUpdate } from "./planPatch.js";

const AGENT = "verifier" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function envInt(name: string, dflt: number): number {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : dflt;
}

type EventBase = Pick<TraceEventInput, "project_id" | "turn" | "agent" | "agent_run_id">;

function baseFor(ctx: AgentContext): EventBase {
  return {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  };
}

async function emit(orch: OrchClient, base: EventBase, ev: Omit<TraceEventInput, keyof EventBase>) {
  await orch.postEvent({ ...base, ...ev });
}

async function main() {
  const rawText = await readStdin();
  const rawJson = JSON.parse(rawText);
  const trigger = extractTriggerEvent(rawJson);
  const ctx = AgentContextSchema.parse(rawJson);

  const orch = makeOrchClient(ctx.env.orchestrator_url, ctx.turn_id);
  const intUrl = ctx.env.integrations_url;
  const base = baseFor(ctx);
  const isFixture = ctx.env.fixture_mode || process.env.FIXTURE_MODE === "true";

  const plannedTopic = ctx.plan.terac_studies_planned[0]?.topic ?? "verify";
  const topic = topicFromTrigger(trigger, plannedTopic);

  await emit(orch, base, {
    type: "thought",
    content: trigger
      ? `Verifying ${topic} — trigger from ${trigger.agent} (confidence ${trigger.confidence ?? "?"}).`
      : `Verifying ${topic} — no explicit trigger; running planned study.`,
    ts: nowIso(),
  });

  // ---- Dedup ---------------------------------------------------------------
  if (shouldDedup(ctx, topic)) {
    await emit(orch, base, {
      type: "thought",
      content: `Skip verify: same topic (${topic}) answered within the last 3 turns.`,
      ts: nowIso(),
    });
    await emit(orch, base, {
      type: "result",
      content: `verifier skipped (dedup on topic=${topic})`,
      ts: nowIso(),
    });
    return;
  }

  const targetResponses = envInt("TERAC_DEFAULT_SAMPLE_SIZE", 15);
  const timeoutSec = envInt("TERAC_DEFAULT_TIMEOUT_SEC", 300);

  // ---- Formulate the ask ---------------------------------------------------
  const ask: TeracAsk = await formulateAsk({ ctx, trigger, topic, targetResponses });

  // ---- Call Terac ----------------------------------------------------------
  let askId = "";
  let rawResponses: TeracRawResponse;
  try {
    if (isFixture) {
      askId = `fixture-${nanoid(8)}`;
      await stageDelay();
      rawResponses = loadCannedResponse(topic, ask, askId);
    } else {
      askId = await postAsk(intUrl, ask);
      await emit(orch, base, {
        type: "terac_call",
        content: `Asking ${ask.audience}: "${ask.question}" (target ${ask.target_responses}).`,
        ts: nowIso(),
        metadata: { ask: { ...ask, ask_id: askId } },
      });
      rawResponses = await pollResult(intUrl, askId, { timeoutSec });
    }

    if (isFixture) {
      await emit(orch, base, {
        type: "terac_call",
        content: `Asking ${ask.audience}: "${ask.question}" (target ${ask.target_responses}).`,
        ts: nowIso(),
        metadata: { ask: { ...ask, ask_id: askId } },
      });
    }
  } catch (err) {
    await handleTeracFailure({ orch, base, ctx, trigger, topic, ask, askId, err });
    return;
  }

  await emit(orch, base, {
    type: "terac_result",
    content: `Received ${rawResponses.responses.length} raw responses for ${topic}.`,
    ts: nowIso(),
    metadata: { ask_id: askId, count: rawResponses.responses.length },
  });

  // ---- Aggregate (Verifier owns) ------------------------------------------
  const { aggregate, after } = await aggregateResponses({ raw: rawResponses, trigger, topic });

  // ---- Build DecisionRecord -----------------------------------------------
  const before = beforeFromTrigger(trigger, ctx);
  const decision: DecisionRecord = DecisionRecordSchema.parse({
    project_id: ctx.project_id,
    decision_id: nanoid(8),
    topic,
    before,
    after,
    aggregate,
    terac_ask_id: askId,
    ts: nowIso(),
  });

  await orch.postDecision(decision);

  await emit(orch, base, {
    type: "decision",
    content: swingSummary(decision),
    ts: nowIso(),
    confidence: after.confidence,
    metadata: {
      decision_id: decision.decision_id,
      topic,
      before_confidence: before.confidence,
      after_confidence: after.confidence,
    },
  });

  // ---- Memory write --------------------------------------------------------
  await orch.postMemory({
    path: decisionMemoryPath(decision.decision_id),
    content: renderDecisionMarkdown({ decision, ask: { ...ask, ask_id: askId }, raw: rawResponses, trigger }),
  });

  // ---- Optional plan update -----------------------------------------------
  const planPatch = derivePlanUpdate(ctx, decision);
  if (planPatch) {
    await orch.postPlan(planPatch);
    await emit(orch, base, {
      type: "plan_update",
      content: `Plan version bumped to v${planPatch.version} on ${topic}.`,
      ts: nowIso(),
      metadata: { version: planPatch.version, topic },
    });
  }

  // ---- Optional owner alert -----------------------------------------------
  const alert = shouldNotifyOwner(trigger, decision);
  if (alert === "notify") {
    try {
      await notifyOwner(intUrl, {
        project_id: ctx.project_id,
        message: `Decision ${decision.decision_id}: ${aggregate}`,
        requires_approval: true,
      });
    } catch (err) {
      await emit(orch, base, {
        type: "error",
        content: `linq/notify failed: ${String((err as Error).message ?? err)}`,
        ts: nowIso(),
      });
    }
  }

  await emit(orch, base, {
    type: "result",
    content: `verifier done: decision=${decision.decision_id} topic=${topic}`,
    ts: nowIso(),
    metadata: { decision_id: decision.decision_id, topic },
  });
}

async function handleTeracFailure(args: {
  orch: OrchClient;
  base: EventBase;
  ctx: AgentContext;
  trigger: TriggerEvent | undefined;
  topic: string;
  ask: TeracAsk;
  askId: string;
  err: unknown;
}) {
  const { orch, base, ctx, trigger, topic, ask, askId, err } = args;
  const before = beforeFromTrigger(trigger, ctx);
  const message = err instanceof Error ? err.message : String(err);

  await orch.postEvent({
    ...base,
    type: "error",
    content: `Terac call failed: ${message}`,
    ts: nowIso(),
  });

  // Preserve the low-confidence prior as the outcome: before === after.
  const decision: DecisionRecord = DecisionRecordSchema.parse({
    project_id: ctx.project_id,
    decision_id: nanoid(8),
    topic,
    before,
    after: {
      value: before.value,
      confidence: before.confidence,
      reasoning: "no human input received within timeout",
    },
    aggregate: "no human input received within timeout",
    terac_ask_id: askId || undefined,
    ts: nowIso(),
  });

  try {
    await orch.postDecision(decision);
    await orch.postMemory({
      path: decisionMemoryPath(decision.decision_id),
      content: renderDecisionMarkdown({
        decision,
        ask: { ...ask, ask_id: askId },
        raw: { ask_id: askId || "unknown", project_id: ctx.project_id, responses: [], received_at: nowIso() },
        trigger,
      }),
    });
  } catch {
    // swallow; error already emitted
  }

  await orch.postEvent({
    ...base,
    type: "result",
    content: `verifier degraded: preserved prior on ${topic}`,
    ts: nowIso(),
    metadata: { decision_id: decision.decision_id, degraded: true },
  });
}

function swingSummary(d: DecisionRecord): string {
  const b = d.before.confidence.toFixed(2);
  const a = d.after.confidence.toFixed(2);
  return `Decision on ${d.topic}: confidence ${b} → ${a}. ${d.aggregate}`.slice(0, 500);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
