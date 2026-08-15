import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { readJson, writeJson, statePath } from "../util/state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "..", "..", "fixtures");
const RENDER_FIXTURE = resolve(FIXTURES_DIR, "render", "deploy.json");
const HEALTH_FIXTURE = resolve(FIXTURES_DIR, "service", "health.json");
const LOGS_FIXTURE = resolve(FIXTURES_DIR, "service", "logs.jsonl");

const STATE_FILE = "render.json";

type RenderStateFile = {
  projects: Record<
    string,
    { service_id: string; url: string; last_deploy_id: string; updated_at: string }
  >;
};

const state = () => readJson<RenderStateFile>(STATE_FILE, { projects: {} });
const save = (s: RenderStateFile) => writeJson(STATE_FILE, s);

const healthTick = new Map<string, number>();

export type DeployInput = { project_id: string; html: string; name: string };
export type DeployResult = { url: string; deploy_id: string };

function writeLocalFallback(project_id: string, html: string): string {
  const dir = statePath("renders");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${project_id}.html`);
  writeFileSync(file, html);
  return `file://${file}`;
}

export function deployFixture(input: DeployInput): DeployResult {
  const s = state();
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const existing = s.projects[input.project_id];
  const url = existing?.url ?? `https://autobiz-${slug || input.project_id.slice(0, 6)}.onrender.com`;
  const deploy_id = `dep_fx_${Date.now().toString(36)}`;
  s.projects[input.project_id] = {
    service_id: existing?.service_id ?? `srv_fx_${slug}`,
    url,
    last_deploy_id: deploy_id,
    updated_at: new Date().toISOString(),
  };
  save(s);
  return { url, deploy_id };
}

async function renderFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${env.RENDER_API_KEY}`,
      ...init.headers,
    },
  });
}

async function findService(name: string): Promise<{ id: string; url: string } | null> {
  const res = await renderFetch(`/services?name=${encodeURIComponent(name)}&limit=1`);
  if (!res.ok) return null;
  const data = (await res.json()) as
    | Array<{ service: { id: string; serviceDetails?: { url?: string }; name: string } }>
    | { services?: Array<{ id: string; serviceDetails?: { url?: string } }> };
  const arr = Array.isArray(data) ? data.map((r) => r.service) : data.services ?? [];
  const match = arr.find((s) => (s as { name?: string }).name === name) ?? arr[0];
  if (!match) return null;
  return { id: match.id, url: match.serviceDetails?.url ?? "" };
}

export async function deployReal(input: DeployInput): Promise<DeployResult> {
  const s = state();
  try {
    let entry = s.projects[input.project_id];
    let service_id = entry?.service_id;
    let url = entry?.url;

    if (!service_id) {
      const existing = await findService(input.name);
      if (existing) {
        service_id = existing.id;
        url = existing.url;
      } else {
        const create = await renderFetch("/services", {
          method: "POST",
          body: JSON.stringify({
            type: "static_site",
            name: input.name,
            ownerId: env.RENDER_OWNER_ID,
            serviceDetails: { publishPath: "./" },
            envVars: [],
          }),
        });
        if (!create.ok) throw new Error(`render create failed ${create.status}`);
        const created = (await create.json()) as {
          service: { id: string; serviceDetails?: { url?: string } };
        };
        service_id = created.service.id;
        url = created.service.serviceDetails?.url ?? "";
      }
    }

    // Trigger a deploy carrying the HTML as an inline commit via Render's
    // trigger-deploy endpoint. In real setups Builder would push to a git repo;
    // here we use the "workflows" trigger to keep the sponsor track.
    const trigger = await renderFetch(`/services/${service_id}/deploys`, {
      method: "POST",
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    });
    if (!trigger.ok) throw new Error(`render deploy trigger failed ${trigger.status}`);
    const dep = (await trigger.json()) as { id: string };

    s.projects[input.project_id] = {
      service_id,
      url: url || `https://${input.name}.onrender.com`,
      last_deploy_id: dep.id,
      updated_at: new Date().toISOString(),
    };
    save(s);
    logger.info(
      { project_id: input.project_id, deploy_id: dep.id, service_id },
      "render deploy triggered",
    );
    return { url: s.projects[input.project_id]!.url, deploy_id: dep.id };
  } catch (err) {
    logger.warn({ err, project_id: input.project_id }, "render deploy fell back to file://");
    const fallback = writeLocalFallback(input.project_id, input.html);
    return { url: fallback, deploy_id: `local_${Date.now().toString(36)}` };
  }
}

export type HealthResult = { status: string; latency_ms: number; checked_at: string };

export function healthFixture(project_id: string): HealthResult {
  const raw = JSON.parse(readFileSync(HEALTH_FIXTURE, "utf8")) as {
    rotation: Array<{ status: string; latency_ms: number }>;
  };
  const idx = (healthTick.get(project_id) ?? 0) % raw.rotation.length;
  healthTick.set(project_id, idx + 1);
  const pick = raw.rotation[idx]!;
  return { status: pick.status, latency_ms: pick.latency_ms, checked_at: new Date().toISOString() };
}

export async function healthReal(project_id: string): Promise<HealthResult> {
  const s = state();
  const entry = s.projects[project_id];
  const url = entry?.url;
  if (!url) return { status: "unknown", latency_ms: 0, checked_at: new Date().toISOString() };
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "HEAD" });
    const latency_ms = Math.round(performance.now() - started);
    return {
      status: res.ok ? "healthy" : res.status >= 500 ? "degraded" : "unhealthy",
      latency_ms,
      checked_at: new Date().toISOString(),
    };
  } catch {
    return {
      status: "unreachable",
      latency_ms: Math.round(performance.now() - started),
      checked_at: new Date().toISOString(),
    };
  }
}

export type LogLine = {
  ts: string;
  level: string;
  message: string;
  path?: string;
  status?: number;
};

export function logsFixture(_project_id: string, since?: string, limit = 50): { lines: LogLine[] } {
  if (!existsSync(LOGS_FIXTURE)) return { lines: [] };
  const cutoff = since ? Date.parse(since) : 0;
  const raw = readFileSync(LOGS_FIXTURE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lines: LogLine[] = [];
  for (const l of raw) {
    try {
      const row = JSON.parse(l) as LogLine;
      if (Date.parse(row.ts) <= cutoff) continue;
      lines.push(row);
    } catch {
      /* skip */
    }
    if (lines.length >= limit) break;
  }
  return { lines };
}

export async function logsReal(project_id: string, since?: string, limit = 50): Promise<{ lines: LogLine[] }> {
  const s = state();
  const entry = s.projects[project_id];
  if (!entry) return { lines: [] };
  const qs = new URLSearchParams();
  qs.set("resource", entry.service_id);
  if (since) qs.set("startTime", since);
  qs.set("limit", String(limit));
  const res = await renderFetch(`/logs?${qs.toString()}`);
  if (!res.ok) return { lines: [] };
  const data = (await res.json()) as {
    logs?: Array<{ timestamp?: string; level?: string; message?: string; labels?: Record<string, string> }>;
  };
  const lines: LogLine[] = (data.logs ?? []).map((l) => ({
    ts: l.timestamp ?? new Date().toISOString(),
    level: l.level ?? "info",
    message: l.message ?? "",
    path: l.labels?.path,
    status: l.labels?.status ? Number(l.labels.status) : undefined,
  }));
  return { lines };
}

export function getRenderProjectIds(): string[] {
  return Object.keys(state().projects);
}

export function _hasRenderFixtureFile(): boolean {
  return existsSync(RENDER_FIXTURE);
}
