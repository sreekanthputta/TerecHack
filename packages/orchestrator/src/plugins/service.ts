import type { PluginConfig, PluginId } from "@autobiz/shared";
import { PLUGIN_CATALOG, getPluginDescriptor } from "./catalog.js";
import { buildMaskedPreview, decryptFields, encryptFields, maskSecret } from "./crypto.js";
import type { Repo } from "../db/repo.js";
import { env } from "../env.js";

/**
 * Plugin config service. Handles encrypt-on-store, mask-on-read.
 * Never returns raw secrets. Never writes them to logs.
 */

function envMaskedPreview(id: PluginId): Record<string, string> {
  const d = getPluginDescriptor(id);
  if (!d) return {};
  const out: Record<string, string> = {};
  for (const f of d.fields) {
    const v = process.env[f.key];
    if (!v) continue;
    out[f.key] = f.secret ? maskSecret(v) : v;
  }
  return out;
}

export function listPluginConfigs(repo: Repo): PluginConfig[] {
  const rows = new Map(repo.listPluginConfigs().map((r) => [r.id, r] as const));
  const out: PluginConfig[] = [];
  for (const d of PLUGIN_CATALOG) {
    const row = rows.get(d.id);
    if (row) {
      out.push({
        id: d.id,
        connected: row.connected,
        masked_preview: JSON.parse(row.masked_json) as Record<string, string>,
        ...(row.connected_at ? { connected_at: row.connected_at } : {}),
      });
      continue;
    }

    // Fall back to env-derived preview when demo mode is on, otherwise unconnected.
    if (env.demo_settings_mode) {
      const preview = envMaskedPreview(d.id);
      const hasAny = Object.keys(preview).length > 0;
      out.push({
        id: d.id,
        connected: hasAny,
        masked_preview: preview,
        ...(hasAny ? { connected_at: new Date().toISOString() } : {}),
      });
    } else {
      out.push({ id: d.id, connected: false, masked_preview: {} });
    }
  }
  return out;
}

export function storePluginConfig(repo: Repo, id: PluginId, fields: Record<string, string>): PluginConfig {
  const descriptor = getPluginDescriptor(id);
  if (!descriptor) throw new Error(`unknown plugin: ${id}`);
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v !== "string" || v === "") continue;
    cleaned[k] = v;
  }
  const masked = buildMaskedPreview(descriptor.fields, cleaned);
  const encrypted = Object.keys(cleaned).length > 0 ? encryptFields(cleaned) : null;
  const connectedAt = new Date().toISOString();
  repo.upsertPluginConfig({
    id,
    connected: Object.keys(cleaned).length > 0,
    encrypted_json: encrypted,
    masked_json: JSON.stringify(masked),
    connected_at: connectedAt,
  });
  return {
    id,
    connected: Object.keys(cleaned).length > 0,
    masked_preview: masked,
    connected_at: connectedAt,
  };
}

export function deletePluginConfig(repo: Repo, id: PluginId): void {
  repo.deletePluginConfig(id);
}

/**
 * Read decrypted secrets for a stored plugin config. Internal use only —
 * never expose the result outside the orchestrator process.
 */
export function readDecrypted(repo: Repo, id: PluginId): Record<string, string> | null {
  const row = repo.getPluginConfig(id);
  if (!row || !row.encrypted_json) return null;
  return decryptFields(row.encrypted_json);
}
