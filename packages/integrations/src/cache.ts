import { env } from "./env.js";
import { logger } from "./logger.js";
import { getFixtureCharges, getRealCharges, getStripeProjectIds } from "./clients/stripe-client.js";
import { getRenderProjectIds, healthFixture, healthReal } from "./clients/render.js";

/**
 * Background job: for every `live` project, refresh Stripe balance every 15s
 * and Render health every 30s, keeping an in-memory `lastKnown` map so cron
 * agents get a fresh read on their tick. We don't push to the orchestrator —
 * cron agents pull.
 */

type StripeSnapshot = { balance_usd: number; count: number; at: string };
type HealthSnapshot = { status: string; latency_ms: number; checked_at: string };

const stripeCache = new Map<string, StripeSnapshot>();
const healthCache = new Map<string, HealthSnapshot>();

export function getLastKnownStripe(project_id: string): StripeSnapshot | undefined {
  return stripeCache.get(project_id);
}

export function getLastKnownHealth(project_id: string): HealthSnapshot | undefined {
  return healthCache.get(project_id);
}

async function refreshStripe(): Promise<void> {
  const ids = getStripeProjectIds();
  for (const id of ids) {
    try {
      const charges = env.FIXTURE_MODE ? getFixtureCharges(id) : await getRealCharges(id);
      stripeCache.set(id, {
        balance_usd: charges.balance_usd,
        count: charges.count,
        at: new Date().toISOString(),
      });
    } catch (err) {
      logger.debug({ err, id }, "stripe balance refresh failed");
    }
  }
}

async function refreshHealth(): Promise<void> {
  const ids = getRenderProjectIds();
  for (const id of ids) {
    try {
      const h = env.FIXTURE_MODE ? healthFixture(id) : await healthReal(id);
      healthCache.set(id, h);
    } catch (err) {
      logger.debug({ err, id }, "render health refresh failed");
    }
  }
}

let stripeTimer: NodeJS.Timeout | null = null;
let healthTimer: NodeJS.Timeout | null = null;

export function startBackgroundCache(): void {
  if (stripeTimer || healthTimer) return;
  stripeTimer = setInterval(() => void refreshStripe(), 15_000).unref();
  healthTimer = setInterval(() => void refreshHealth(), 30_000).unref();
  // Kick off an immediate refresh so first tick isn't cold.
  void refreshStripe();
  void refreshHealth();
  logger.info("background cache started (stripe 15s, health 30s)");
}

export function stopBackgroundCache(): void {
  if (stripeTimer) clearInterval(stripeTimer);
  if (healthTimer) clearInterval(healthTimer);
  stripeTimer = null;
  healthTimer = null;
}
