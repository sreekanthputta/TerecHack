import Fastify from "fastify";
import cors from "@fastify/cors";
import { env, assertBootSafety } from "./env.js";
import { logger } from "./logger.js";
import { registerTeracRoutes } from "./routes/terac.js";
import { registerStripeRoutes } from "./routes/stripe.js";
import { registerRenderRoutes } from "./routes/render.js";
import { registerLinqRoutes } from "./routes/linq.js";
import { registerSuperserveRoutes } from "./routes/superserve.js";
import { registerReplayRoutes } from "./routes/replay.js";
import { registerShopifyRoutes } from "./routes/shopify.js";
import { startBackgroundCache } from "./cache.js";

export async function buildApp() {
  assertBootSafety();

  const app = Fastify({ loggerInstance: logger });

  const allowed = new Set(
    [env.NEXT_PUBLIC_APP_URL, env.ORCH_URL].filter((v) => v.length > 0),
  );

  await app.register(cors, {
    origin: (origin, cb) => {
      // Non-browser callers (curl, Node fetch, tests) omit Origin — always allow.
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      cb(new Error(`CORS: origin not allowed: ${origin}`), false);
    },
    credentials: true,
  });

  app.get("/health", async () => ({
    ok: true,
    service: "integrations",
    fixture_mode: env.FIXTURE_MODE,
    ts: new Date().toISOString(),
  }));

  await app.register(registerTeracRoutes);
  await app.register(registerStripeRoutes);
  await app.register(registerRenderRoutes);
  await app.register(registerLinqRoutes);
  await app.register(registerSuperserveRoutes);
  await app.register(registerReplayRoutes);
  await app.register(registerShopifyRoutes);

  return app;
}

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.INTEGRATIONS_PORT, host: "0.0.0.0" });
  app.log.info(
    { port: env.INTEGRATIONS_PORT, fixture_mode: env.FIXTURE_MODE },
    "integrations listening",
  );
  startBackgroundCache();
}

const isEntry = import.meta.url === `file://${process.argv[1]}`;
if (isEntry) {
  main().catch((err) => {
    logger.error({ err }, "integrations failed to boot");
    process.exit(1);
  });
}
