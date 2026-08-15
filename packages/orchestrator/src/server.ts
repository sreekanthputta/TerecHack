import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";

const app = Fastify({ logger: { transport: { target: "pino-pretty" }, level: env.log_level } });

await app.register(cors, {
  origin: (_origin, cb) => cb(null, true),
});

app.get("/health", async () => ({ ok: true, service: "orchestrator", ts: new Date().toISOString() }));

// Stub endpoints — full implementation lives in the agent-b-orch worktree.
app.post("/api/business", async () => ({ project_id: "stub" }));

await app.listen({ port: env.orch_port, host: "0.0.0.0" });
app.log.info(`orchestrator listening on :${env.orch_port} (fixture_mode=${env.fixture_mode})`);
