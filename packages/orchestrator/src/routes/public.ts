import type { FastifyInstance } from "fastify";
import { ulid } from "ulid";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { listProjectMemory } from "../memory/fs.js";
import { listPluginConfigs } from "../plugins/service.js";
import { fallbackPlan } from "../scheduler/planner_fallback.js";

const CreateBusinessSchema = z.object({
  idea: z.string().min(1).max(2000),
  owner_contact: z
    .object({
      channel: z.enum(["imessage", "email"]),
      address: z.string().min(1),
    })
    .optional(),
  idempotency_key: z.string().min(4).max(120),
});

const MessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function registerPublicRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  app.post("/api/business", async (req, reply) => {
    const parsed = CreateBusinessSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", detail: parsed.error.flatten() };
    }
    const body = parsed.data;

    const existing = ctx.repo.findProjectByIdempotencyKey(body.idempotency_key);
    if (existing) {
      return { project_id: existing.id };
    }

    const project_id = ulid();
    ctx.repo.createProject({
      id: project_id,
      goal: body.idea,
      idempotency_key: body.idempotency_key,
    });

    // Emit orchestrator trace event (turn 0)
    ctx.recordEvent({
      project_id,
      turn: 0,
      agent: "orchestrator",
      agent_run_id: "00000000-0000-4000-8000-000000000000",
      type: "action",
      content: `project started: ${body.idea}`,
      ts: new Date().toISOString(),
    });

    // Seed a fallback plan v1 so agents have something to work with even if
    // the Planner hasn't returned yet.
    const contact = body.owner_contact ?? {
      channel: "email" as const,
      address: ctx.env.demo_owner_email,
    };
    const plan = fallbackPlan(project_id, body.idea, contact);
    ctx.repo.insertPlan(plan);

    // Kick off planner turn 0
    if (ctx.scheduler) {
      const configs = listPluginConfigs(ctx.repo);
      ctx.scheduler.startProject(project_id, plan, configs);
    }

    return { project_id };
  });

  app.get<{ Params: { id: string } }>("/api/business/:id", async (req, reply) => {
    const state = ctx.repo.getBusinessState(req.params.id);
    if (!state) {
      reply.code(404);
      return { error: "not_found" };
    }
    return state;
  });

  app.get("/api/businesses", async () => {
    const projects = ctx.repo.listProjects();
    return projects
      .map((p) => ctx.repo.getBusinessState(p.id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  });

  app.get<{ Params: { id: string }; Querystring: { since?: string; limit?: string } }>(
    "/api/business/:id/events",
    async (req) => {
      const since = Number(req.query.since ?? "0") || 0;
      const limit = Math.max(1, Math.min(1000, Number(req.query.limit ?? "200") || 200));
      return ctx.repo.listEvents(req.params.id, since, limit);
    },
  );

  app.get<{ Params: { id: string } }>("/api/business/:id/decisions", async (req) => {
    return ctx.repo.listDecisions(req.params.id);
  });

  app.get<{ Params: { id: string } }>("/api/business/:id/memory", async (req) => {
    return { files: listProjectMemory(req.params.id) };
  });

  app.post<{ Params: { id: string } }>("/api/business/:id/message", async (req, reply) => {
    const parsed = MessageSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_body", detail: parsed.error.flatten() };
    }
    const project = ctx.repo.getProject(req.params.id);
    if (!project) {
      reply.code(404);
      return { error: "not_found" };
    }
    ctx.repo.insertMessage(req.params.id, parsed.data.content);
    const nextTurn = ctx.repo.nextTurnNumber(req.params.id);
    ctx.recordEvent({
      project_id: req.params.id,
      turn: nextTurn,
      agent: "orchestrator",
      agent_run_id: "00000000-0000-4000-8000-000000000000",
      type: "action",
      content: `owner queued: ${parsed.data.content.slice(0, 400)}`,
      ts: new Date().toISOString(),
    });
    return { queued_for_turn: nextTurn };
  });
}
