import type { FastifyInstance, FastifyReply } from "fastify";
import {
  BugReportSchema,
  BusinessPlanSchema,
  BusinessStatePatchSchema,
  DecisionRecordSchema,
  TraceEventInputSchema,
} from "@autobiz/shared";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { writeProjectMemory } from "../memory/fs.js";
import { listPluginConfigs } from "../plugins/service.js";
import type { TurnRow } from "../db/repo.js";

function assertActiveTurn(reply: FastifyReply, turn: TurnRow | undefined): TurnRow | null {
  if (!turn) {
    reply.code(404);
    reply.send({ error: "unknown_turn" });
    return null;
  }
  if (turn.status !== "running") {
    reply.code(409);
    reply.send({ error: "turn_not_running", status: turn.status });
    return null;
  }
  return turn;
}

const MemoryWriteSchema = z.object({
  path: z.string().min(1).max(300),
  content: z.string().min(1).max(200_000),
});

export async function registerInternalRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/events", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = TraceEventInputSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_event", detail: parsed.error.flatten() };
    }
    if (parsed.data.project_id !== turn.project_id) {
      reply.code(403);
      return { error: "project_mismatch" };
    }
    const ev = ctx.recordEvent(parsed.data);

    if (parsed.data.confidence !== undefined && parsed.data.confidence < 0.6) {
      const plan = ctx.repo.getLatestPlan(turn.project_id);
      if (plan && ctx.scheduler) {
        ctx.scheduler.spawnVerifier(turn.project_id, plan, listPluginConfigs(ctx.repo));
      }
    }
    return { id: ev.id };
  });

  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/decisions", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = DecisionRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_decision", detail: parsed.error.flatten() };
    }
    if (parsed.data.project_id !== turn.project_id) {
      reply.code(403);
      return { error: "project_mismatch" };
    }
    ctx.repo.insertDecision(parsed.data);
    ctx.repo.incrementDecisions(turn.project_id);
    // Synthetic trace event so UI sees the decision
    ctx.recordEvent({
      project_id: turn.project_id,
      turn: turn.turn,
      agent: turn.agent,
      agent_run_id: turn.agent_run_id,
      type: "decision",
      content: `${parsed.data.topic}: ${parsed.data.aggregate.slice(0, 400)}`,
      ts: parsed.data.ts,
      confidence: parsed.data.after.confidence,
      metadata: { decision_id: parsed.data.decision_id, topic: parsed.data.topic },
    });
    return { ok: true };
  });

  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/plan", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = BusinessPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_plan", detail: parsed.error.flatten() };
    }
    if (parsed.data.project_id !== turn.project_id) {
      reply.code(403);
      return { error: "project_mismatch" };
    }
    ctx.repo.insertPlan(parsed.data);
    ctx.repo.bumpPlanVersion(turn.project_id, parsed.data.version);
    ctx.recordEvent({
      project_id: turn.project_id,
      turn: turn.turn,
      agent: turn.agent,
      agent_run_id: turn.agent_run_id,
      type: "plan_update",
      content: `plan v${parsed.data.version} — ${parsed.data.vertical}, budget $${parsed.data.budget_usd}`,
      ts: new Date().toISOString(),
      metadata: { version: parsed.data.version },
    });
    return { ok: true };
  });

  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/bugs", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = BugReportSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_bugs", detail: parsed.error.flatten() };
    }
    if (parsed.data.project_id !== turn.project_id) {
      reply.code(403);
      return { error: "project_mismatch" };
    }
    ctx.repo.insertBugs(turn.project_id, parsed.data.builder_version, parsed.data.bugs, parsed.data.ts);
    const open = ctx.repo.countOpenBugs(turn.project_id);
    ctx.repo.setBugsOpen(turn.project_id, open);
    ctx.recordEvent({
      project_id: turn.project_id,
      turn: turn.turn,
      agent: turn.agent,
      agent_run_id: turn.agent_run_id,
      type: "bugs_found",
      content: `replay-qa: passed=${parsed.data.passed} failed=${parsed.data.failed}`,
      ts: parsed.data.ts,
      metadata: { failed: parsed.data.failed, passed: parsed.data.passed, run_id: parsed.data.run_id },
    });
    return { ok: true };
  });

  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/state", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = BusinessStatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_state", detail: parsed.error.flatten() };
    }
    if (parsed.data.status === "live" && turn.agent !== "replay-qa") {
      reply.code(403);
      return { error: "only_replay_qa_can_go_live", agent: turn.agent };
    }
    ctx.repo.patchBusinessState(turn.project_id, parsed.data);
    return { ok: true };
  });

  app.post<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/memory", async (req, reply) => {
    const turn = assertActiveTurn(reply, ctx.repo.getTurn(req.params.turn_id));
    if (!turn) return;
    const parsed = MemoryWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_memory", detail: parsed.error.flatten() };
    }
    try {
      const written = writeProjectMemory(turn.project_id, parsed.data.path, parsed.data.content);
      return { ok: true, path: written };
    } catch (err) {
      reply.code(400);
      return { error: "memory_write_rejected", detail: String(err) };
    }
  });

  app.get<{ Params: { turn_id: string } }>("/internal/turns/:turn_id/context", async (req, reply) => {
    const turn = ctx.repo.getTurn(req.params.turn_id);
    if (!turn) {
      reply.code(404);
      return { error: "unknown_turn" };
    }
    const plan = ctx.repo.getLatestPlan(turn.project_id);
    if (!plan) {
      reply.code(404);
      return { error: "no_plan" };
    }
    if (turn.agent === "orchestrator") {
      reply.code(400);
      return { error: "orchestrator_has_no_context" };
    }
    if (ctx.spawner) {
      const prior_bugs =
        turn.agent === "builder"
          ? ctx.repo.listOpenBugs(turn.project_id).map((b) => ({
              bug_id: b.bug_id,
              severity: b.severity,
              where: b.where_,
              observed: b.observed,
              expected: b.expected,
              repro: JSON.parse(b.repro_json) as string[],
            }))
          : undefined;
      return ctx.spawner.buildContext({
        turn_id: turn.turn_id,
        project_id: turn.project_id,
        turn: turn.turn,
        agent: turn.agent,
        agent_run_id: turn.agent_run_id,
        plan,
        pluginConfigs: listPluginConfigs(ctx.repo),
        extras: prior_bugs && prior_bugs.length > 0 ? { prior_bugs } : {},
      });
    }
    reply.code(503);
    return { error: "spawner_unavailable" };
  });
}
