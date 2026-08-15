import Fastify from "fastify";
import cors from "@fastify/cors";

const stripeKey = process.env.STRIPE_RESTRICTED_KEY ?? "";
if (stripeKey.startsWith("sk_")) {
  console.error(
    "Integrations refuses to boot: STRIPE_RESTRICTED_KEY starts with 'sk_'. Use a restricted rk_ key.",
  );
  process.exit(1);
}

const app = Fastify({ logger: { transport: { target: "pino-pretty" } } });

await app.register(cors, {
  origin: (origin, cb) => cb(null, true),
});

app.get("/health", async () => ({
  ok: true,
  service: "integrations",
  fixture_mode: process.env.FIXTURE_MODE === "true",
  ts: new Date().toISOString(),
}));

// Stub endpoints — full implementation lives in the agent-e-integrations worktree.
app.post("/terac/ask", async () => ({ ask_id: "fixture-stub" }));
app.get("/terac/result/:ask_id", async (_req, reply) => reply.code(202).send({ pending: true }));
app.post("/stripe/payment-link", async () => ({ url: "https://buy.stripe.com/test_stub", id: "pl_stub" }));
app.get("/stripe/charges/:project_id", async () => ({ charges: [], balance_usd: 0, count: 0 }));
app.post("/render/deploy", async () => ({ url: "https://stub.onrender.com", deploy_id: "dep_stub" }));
app.get("/render/health/:project_id", async () => ({ status: "healthy", latency_ms: 42, checked_at: new Date().toISOString() }));
app.get("/render/logs/:project_id", async () => ({ lines: [] }));
app.post("/linq/notify", async () => ({ sid: "lq_stub" }));
app.post("/superserve/session", async () => ({ session_id: "ss_stub", browser_ws_url: "ws://stub" }));
app.delete("/superserve/session/:id", async () => ({ ok: true }));
app.post("/replay/project", async () => ({ id: "lqa_stub", url: "https://qa.replay.io/projects/stub", exploration_id: "expl_stub" }));
app.get("/replay/project/:id/status", async () => ({ state: "done", journeys_passed_count: 0, journeys_total: 0, updated_at: new Date().toISOString() }));
app.get("/replay/project/:id/bugs", async () => ({ bugs: [] }));
app.get("/replay/bugs/:bug_id", async () => ({ id: "b_stub", severity: "minor", title: "stub", observed: "-", expected: "-", repro: [], evidence_url: "-", route: "-" }));
app.post("/replay/project/:id/explorations", async () => ({ exploration_id: "expl_stub_2" }));

const port = Number(process.env.INTEGRATIONS_PORT ?? process.env.PORT ?? 4100);
await app.listen({ port, host: "0.0.0.0" });
app.log.info(`integrations stub listening on :${port}`);
