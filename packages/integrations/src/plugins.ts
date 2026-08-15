import { createDecipheriv } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { PluginId } from "@autobiz/shared";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Plugin registry glue.
 *
 * Design: this package is the ONLY place that decrypts stored plugin secrets.
 * The orchestrator writes encrypted values into `plugin_configs.encrypted_json`
 * (AES-256-GCM keyed by ENCRYPTION_KEY). We read them back here.
 *
 * Until the orchestrator ships that table, we degrade gracefully:
 *   1. Prefer `state/plugin-configs.json` (a hand-off file the orchestrator can
 *      write for us — no native SQLite dependency required).
 *   2. Otherwise infer "connected" purely from env-var presence.
 *
 * Never write plaintext secrets to disk here.
 */

const HANDOFF_FILE = resolve(process.cwd(), "state", "plugin-configs.json");

type HandoffEntry = {
  id: PluginId;
  connected: boolean;
  /**
   * Either:
   *  - `values`: plaintext values (only trusted if orchestrator explicitly opts in)
   *  - `encrypted`: { iv, tag, ciphertext } base64 payload — decrypted with ENCRYPTION_KEY
   */
  values?: Record<string, string>;
  encrypted?: { iv: string; tag: string; ciphertext: string };
};

type HandoffFile = { entries: HandoffEntry[] };

function readHandoff(): HandoffFile | null {
  if (!existsSync(HANDOFF_FILE)) return null;
  try {
    return JSON.parse(readFileSync(HANDOFF_FILE, "utf8")) as HandoffFile;
  } catch (err) {
    logger.warn({ err }, "plugin-configs.json unreadable — falling back to env");
    return null;
  }
}

function decryptValues(payload: HandoffEntry["encrypted"]): Record<string, string> {
  if (!payload) return {};
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes hex");
  }
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ct = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as Record<string, string>;
}

// ─── Env fallback: plugin → { field key → env value } ─────────────────────────

const ENV_FIELDS: Record<PluginId, string[]> = {
  terac: ["TERAC_API_KEY", "TERAC_ORG_ID", "TERAC_PANEL_URL"],
  stripe: ["STRIPE_RESTRICTED_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET"],
  anthropic: ["ANTHROPIC_API_KEY"],
  render: ["RENDER_API_KEY", "RENDER_OWNER_ID"],
  linq: ["LINQ_API_KEY", "LINQ_OWNER_PHONE", "LINQ_WEBHOOK_SECRET"],
  superserve: ["SUPERSERVE_API_KEY"],
  replay: ["REPLAY_API_KEY"],
  shopify: ["SHOPIFY_ADMIN_TOKEN", "SHOPIFY_SHOP_DOMAIN"],
  cloudflare: ["CLOUDFLARE_API_TOKEN"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  sendgrid: ["SENDGRID_API_KEY"],
  ga4: ["GA4_MEASUREMENT_ID"],
  etsy: ["ETSY_API_KEY"],
  meta_ads: ["META_ACCESS_TOKEN"],
  amazon: ["AMAZON_SELLER_KEY"],
};

function envValues(id: PluginId): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ENV_FIELDS[id]) {
    const v = process.env[key];
    if (v && v.length > 0 && !/^(?:replace_me|change_me)/i.test(v)) out[key] = v;
  }
  return out;
}

function envConnected(id: PluginId): boolean {
  const values = envValues(id);
  // Consider "connected" if the primary (first) key is set.
  const primary = ENV_FIELDS[id][0];
  if (!primary) return false;
  return !!values[primary];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getEnabledPlugins(): PluginId[] {
  const handoff = readHandoff();
  if (handoff) {
    return handoff.entries.filter((e) => e.connected).map((e) => e.id);
  }
  const all = Object.keys(ENV_FIELDS) as PluginId[];
  return all.filter((id) => envConnected(id));
}

export function getPluginSecrets(id: PluginId): Record<string, string> {
  const handoff = readHandoff();
  if (handoff) {
    const entry = handoff.entries.find((e) => e.id === id);
    if (entry && entry.connected) {
      if (entry.values) return entry.values;
      if (entry.encrypted) return decryptValues(entry.encrypted);
    }
  }
  return envValues(id);
}

export function isPluginConnected(id: PluginId): boolean {
  if (env.FIXTURE_MODE) return true; // fixtures always "connected"
  return getEnabledPlugins().includes(id);
}
