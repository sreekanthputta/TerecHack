import type Database from "better-sqlite3";
import type { Logger } from "pino";
import type { TraceEvent, TraceEventInput } from "@autobiz/shared";
import { Repo } from "./db/repo.js";
import { bus } from "./sse/bus.js";
import { rootLogger } from "./logger.js";
import { env, type Env } from "./env.js";
import type { Spawner } from "./scheduler/spawner.js";
import type { TurnScheduler } from "./scheduler/turn_scheduler.js";

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
      return ev;
    },
  };
  return ctx;
}
