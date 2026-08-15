import Fastify from "fastify";
import cors from "@fastify/cors";

const stripeKey = process.env.STRIPE_RESTRICTED_KEY ?? "";
if (stripeKey.startsWith("sk_")) {
  console.error(
    "Orchestrator refuses to boot: STRIPE_RESTRICTED_KEY starts with 'sk_'. Use a restricted rk_ key.",
  );
  process.exit(1);
}

const app = Fastify({ logger: { transport: { target: "pino-pretty" } } });

await app.register(cors, {
  origin: (origin, cb) => cb(null, true),
});

app.get("/health", async () => ({ ok: true, service: "orchestrator", ts: new Date().toISOString() }));

// Stub endpoints — full implementation lives in the agent-b-orch worktree.
app.post("/api/business", async () => ({ project_id: "stub" }));

const port = Number(process.env.ORCH_PORT ?? process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`orchestrator stub listening on :${port}`);
