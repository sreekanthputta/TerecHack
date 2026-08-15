import type { AgentContext, BusinessPlan } from "@autobiz/shared";
import { makeEmitter, postMemory, postPlan, type Emitter } from "./emit.js";
import { fixtureToPlan, pickFixture } from "./fixtures.js";
import { callPlanner } from "./llm.js";
import { renderPlanMd } from "./planMd.js";
import { readContext } from "./stdin.js";

function isSeedPlan(plan: BusinessPlan | null | undefined): boolean {
  return !!plan && plan.agents.length === 0;
}

function extractOwnerIdea(ctx: AgentContext): string {
  if (ctx.messages.length > 0) {
    const first = ctx.messages[0];
    if (first) return first;
  }
  return ctx.plan?.goal ?? "Owner did not provide a specific idea.";
}

function pickLearnedPatterns(ctx: AgentContext): string[] {
  return ctx.memory.workspace
    .filter((p) => p.toLowerCase().includes("learned_patterns"))
    .slice(0, 5);
}

function determineVersion(ctx: AgentContext): number {
  const prior = ctx.plan;
  if (!prior || isSeedPlan(prior)) return 1;
  return prior.version + 1;
}

function isPivot(ctx: AgentContext): boolean {
  if (ctx.messages.length === 0) return false;
  return !!ctx.plan && !isSeedPlan(ctx.plan);
}

async function emitThoughts(emit: Emitter, thoughts: string[]) {
  for (const t of thoughts) {
    if (!t.trim()) continue;
    await emit({ type: "thought", content: t.trim() });
  }
}

async function produceAndPostPlan(
  ctx: AgentContext,
  emit: Emitter,
  version: number,
  ownerIdea: string,
): Promise<{ plan: BusinessPlan; thinBets: Record<string, number>; source: "llm" | "fixture" }> {
  const ownerContact = ctx.plan?.owner_contact ?? { channel: "imessage" as const, address: "unknown" };
  const fixtureMode = ctx.env.fixture_mode || process.env.FIXTURE_MODE === "true";

  if (fixtureMode) {
    await emit({ type: "thought", content: "Fixture mode on — using bundled plan template instead of calling Claude." });
    const fx = pickFixture(ownerIdea);
    const plan = fixtureToPlan(fx, {
      project_id: ctx.project_id,
      version,
      goal: ownerIdea,
      owner_contact: ownerContact,
    });
    return { plan, thinBets: {}, source: "fixture" };
  }

  const learned = pickLearnedPatterns(ctx);
  const result = await callPlanner({
    ownerIdea,
    learnedPatterns: learned,
    priorPlan: ctx.plan && !isSeedPlan(ctx.plan) ? ctx.plan : null,
    pivotMessages: isPivot(ctx) ? ctx.messages : [],
    projectId: ctx.project_id,
    version,
    ownerContact,
  });

  if (!result.ok) {
    await emit({ type: "error", content: `Planner LLM failed after retry: ${result.error}. Falling back to fixture.` });
    const fx = pickFixture(ownerIdea);
    const plan = fixtureToPlan(fx, {
      project_id: ctx.project_id,
      version,
      goal: ownerIdea,
      owner_contact: ownerContact,
    });
    return { plan, thinBets: {}, source: "fixture" };
  }

  await emitThoughts(emit, result.reasoning);
  return { plan: result.plan, thinBets: result.thinBets ?? {}, source: "llm" };
}

async function main() {
  const ctx = await readContext();
  const emit = makeEmitter(ctx);
  const orchUrl = ctx.env.orchestrator_url;
  const turnId = ctx.turn_id;

  try {
    const version = determineVersion(ctx);
    const ownerIdea = extractOwnerIdea(ctx);

    if (isPivot(ctx)) {
      const priorGoal = ctx.plan?.goal ?? "(none)";
      await emit({
        type: "thought",
        content: `Pivot detected: prior goal "${priorGoal}" — absorbing ${ctx.messages.length} owner message(s). Producing v${version}.`,
      });
    } else {
      await emit({ type: "thought", content: `Planning v${version} for owner idea: "${ownerIdea}".` });
    }

    const { plan, thinBets, source } = await produceAndPostPlan(ctx, emit, version, ownerIdea);

    await postPlan(orchUrl, turnId, plan);

    const md = renderPlanMd(plan, { agent_run_id: ctx.agent_run_id, turn: ctx.turn });
    await postMemory(orchUrl, turnId, `projects/${plan.project_id}/plan.md`, md);

    await emit({
      type: "plan_update",
      content: `Plan v${plan.version} — vertical=${plan.vertical}, ${plan.agents.length} agent(s), budget $${plan.budget_usd}.`,
      metadata: { source, thin_bets: thinBets },
    });

    for (const [topic, conf] of Object.entries(thinBets)) {
      if (conf < 0.6) {
        await emit({
          type: "thought",
          content: `Low confidence on ${topic} (${conf.toFixed(2)}) — Verifier should escalate to Terac.`,
          confidence: conf,
          metadata: { topic },
        });
      }
    }

    await emit({
      type: "result",
      content: `Planner v${plan.version} shipped (${source}): ${plan.vertical} — ${plan.agents.length} agent tasks queued.`,
    });
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      await emit({ type: "error", content: `Planner crashed: ${msg.slice(0, 400)}` });
    } catch {
      // ignore secondary emit failure
    }
    console.error("planner error:", err);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
