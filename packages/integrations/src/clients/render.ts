import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

function git(args: string[]): string {
  return execFileSync("git", args, {
    cwd: __dirname,
    encoding: "utf8",
    timeout: 60_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}

/**
 * Real deploy: write the generated storefront into the git-backed Render static
 * site's publish dir under a per-project path, commit just that file, and push.
 * Render (autoDeploy on commit) publishes it. Each project gets a distinct,
 * scannable URL at <RENDER_STATIC_SITE_URL>/p/<project_id>/. Falls back to a
 * local file:// path if git/push is unavailable so the demo never 502s.
 */
export async function deployReal(input: DeployInput): Promise<DeployResult> {
  const s = state();
  try {
    const root = git(["rev-parse", "--show-toplevel"]);
    const rel = `${env.RENDER_STATIC_PUBLISH_DIR}/p/${input.project_id}/index.html`;
    const dir = resolve(root, env.RENDER_STATIC_PUBLISH_DIR, "p", input.project_id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "index.html"), input.html);

    git(["-C", root, "add", "--", rel]);
    // Path-scoped commit: touches only this file, leaves other working changes.
    try {
      git(["-C", root, "commit", "-m", `deploy: storefront for ${input.project_id}`, "--", rel]);
    } catch {
      // identical html → nothing to commit; still push in case an earlier
      // deploy commit is unpushed.
    }
    git(["-C", root, "push", "origin", env.RENDER_DEPLOY_BRANCH]);
    const sha = git(["-C", root, "rev-parse", "HEAD"]).slice(0, 9);

    const base = env.RENDER_STATIC_SITE_URL.replace(/\/$/, "");
    const url = `${base}/p/${input.project_id}/`;
    const deploy_id = `git_${sha}`;
    s.projects[input.project_id] = {
      service_id: env.RENDER_STATIC_SITE_URL,
      url,
      last_deploy_id: deploy_id,
      updated_at: new Date().toISOString(),
    };
    save(s);
    logger.info({ project_id: input.project_id, url, deploy_id }, "render deploy pushed to git");
    return { url, deploy_id };
  } catch (err) {
    logger.warn({ err, project_id: input.project_id }, "render git deploy failed; file:// fallback");
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
