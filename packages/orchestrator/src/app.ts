import type Database from "better-sqlite3";
import type { Logger } from "pino";
import type { TraceEvent, TraceEventInput } from "@autobiz/shared";
import { Repo } from "./db/repo.js";
import { bus } from "./sse/bus.js";
import { rootLogger } from "./logger.js";
import { env, type Env } from "./env.js";
import type { Spawner } from "./scheduler/spawner.js";
import type { TurnScheduler } from "./scheduler/turn_scheduler.js";
import { listPluginConfigs } from "./plugins/service.js";

/**
 * Central runtime dependencies. Handlers pull these from `app.ctx` — no
 * globals, so tests can construct their own with a temp db.
 */
export type Ctx = {
  db: Database.Database;
  repo: Repo;
  env: Env;
  logger: Logger;
  recordEvent: (input: TraceEventInput) => TraceEvent;
  scheduler: TurnScheduler | null;
  spawner: Spawner | null;
};

export function createCtx(db: Database.Database): Ctx {
  const repo = new Repo(db);
  const ctx: Ctx = {
    db,
    repo,
    env,
    logger: rootLogger,
    scheduler: null,
    spawner: null,
    recordEvent: (input) => {
      const ev = repo.insertEvent(input);
      bus.publish(ev);
      // Auto-spawn verifier on low-confidence signals from non-verifier agents.
      // Single point of truth — internal REST route does not need to duplicate.
      if (
        ctx.scheduler &&
        input.confidence !== undefined &&
        input.confidence < 0.6 &&
        input.agent !== "verifier" &&
        input.agent !== "orchestrator"
      ) {
        const plan = repo.getLatestPlan(input.project_id);
        if (plan) {
          try {
            ctx.scheduler.spawnVerifier(input.project_id, plan, listPluginConfigs(repo));
          } catch (err) {
            rootLogger.error({ err: String(err) }, "verifier auto-spawn failed");
          }
        }
      }
      return ev;
    },
  };
  return ctx;
}
