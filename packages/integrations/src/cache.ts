import { logger } from "./logger.js";

/**
 * Background refresh for Stripe balance (15s) and Render health (30s) per live
 * project. Cron agents pull from `lastKnown` — we never push to the orchestrator.
 * Fully wired in the Balance/health cache task.
 */
export function startBackgroundCache(): void {
  logger.debug("background cache: not yet enabled");
}
