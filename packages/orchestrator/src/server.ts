import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { rootLogger } from "./logger.js";
import { initDb } from "./db/migrate.js";
import { createCtx } from "./app.js";
import { Spawner } from "./scheduler/spawner.js";
import { TurnScheduler } from "./scheduler/turn_scheduler.js";
import { CronLoop } from "./scheduler/cron.js";
import { registerPublicRoutes } from "./routes/public.js";
import { registerPluginRoutes } from "./routes/plugins.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerSseRoutes } from "./routes/sse.js";
import { ensureMemoryRoot } from "./memory/fs.js";

const app = Fastify({
  logger: env.node_env === "production"
    ? { level: env.log_level }
    : { level: env.log_level, transport: { target: "pino-pretty" } },
  disableRequestLogging: false,
  bodyLimit: 5 * 1024 * 1024,
});

await app.register(cors, {
  origin: (_origin, cb) => cb(null, true),
});

const db = initDb();
ensureMemoryRoot();

const ctx = createCtx(db);
const spawner = new Spawner(ctx, rootLogger);
const scheduler = new TurnScheduler(ctx, spawner, rootLogger);
const cron = new CronLoop(ctx, spawner, rootLogger);
ctx.spawner = spawner;
ctx.scheduler = scheduler;

app.get("/health", async () => ({ ok: true, service: "orchestrator", ts: new Date().toISOString() }));

await registerPublicRoutes(app, ctx);
await registerPluginRoutes(app, ctx);
await registerInternalRoutes(app, ctx);
await registerSseRoutes(app, ctx);

cron.start();

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  rootLogger.info({ signal }, "shutdown requested");
  cron.stop();
  try { await app.close(); } catch (err) { rootLogger.error({ err: String(err) }, "app.close failed"); }
  try { await spawner.killAll(); } catch (err) { rootLogger.error({ err: String(err) }, "killAll failed"); }
  try { db.close(); } catch { /* ignore */ }
  process.exit(0);
};

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

await app.listen({ port: env.orch_port, host: "0.0.0.0" });
rootLogger.info({ port: env.orch_port, fixture_mode: env.fixture_mode }, "orchestrator listening");
