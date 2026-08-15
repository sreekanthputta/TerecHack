import Fastify, { type FastifyInstance } from "fastify";
import { TraceEventInputSchema, type TraceEventInput } from "@autobiz/shared";

/**
 * Minimal orchestrator stand-in used by contract tests.
 * Boots on an ephemeral port; records every posted event; verifies schema.
 */
export type MockOrchestrator = {
  app: FastifyInstance;
  url: string;
  port: number;
  events: TraceEventInput[];
  decisions: unknown[];
  plans: unknown[];
  bugs: unknown[];
  state_patches: unknown[];
  memory_writes: unknown[];
  stop(): Promise<void>;
};

export async function startMockOrchestrator(): Promise<MockOrchestrator> {
  const app = Fastify({ logger: false });

  const events: TraceEventInput[] = [];
  const decisions: unknown[] = [];
  const plans: unknown[] = [];
  const bugs: unknown[] = [];
  const state_patches: unknown[] = [];
  const memory_writes: unknown[] = [];
  let nextId = 1;

  app.post("/internal/turns/:turn_id/events", async (req) => {
    const parsed = TraceEventInputSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error("schema violation");
      (err as any).issues = parsed.error.issues;
      throw err;
    }
    events.push(parsed.data);
    return { id: nextId++ };
  });

  app.post("/internal/turns/:turn_id/decisions", async (req) => {
    decisions.push(req.body);
    return { ok: true };
  });
  app.post("/internal/turns/:turn_id/plan", async (req) => {
    plans.push(req.body);
    return { ok: true };
  });
  app.post("/internal/turns/:turn_id/bugs", async (req) => {
    bugs.push(req.body);
    return { ok: true };
  });
  app.post("/internal/turns/:turn_id/state", async (req) => {
    state_patches.push(req.body);
    return { ok: true };
  });
  app.post("/internal/turns/:turn_id/memory", async (req) => {
    memory_writes.push(req.body);
    return { ok: true };
  });

  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;

  return {
    app,
    url,
    port,
    events,
    decisions,
    plans,
    bugs,
    state_patches,
    memory_writes,
    async stop() {
      await app.close();
    },
  };
}
