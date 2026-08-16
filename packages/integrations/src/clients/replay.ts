import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { maskLast4 } from "../util/mask.js";
import { readJson, writeJson } from "../util/state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUN1 = resolve(__dirname, "..", "..", "fixtures", "replay-qa", "run-1-bugs.json");
const RUN2 = resolve(__dirname, "..", "..", "fixtures", "replay-qa", "run-2-green.json");

const STATE_FILE = "loop-qa.json";

type ExplorationRecord = {
  id: string;
  index: number; // 1-based
  started_at: string;
  finished_at?: string;
};

type LoopQaProjectState = {
  loop_qa_project_id: string;
  autobiz_project_id: string;
  base_url: string;
  design_document: string;
  dashboard_url: string;
  explorations: ExplorationRecord[];
  created_at: string;
};

type LoopQaStateFile = {
  by_autobiz_id: Record<string, string>; // autobiz -> loop qa project id
  projects: Record<string, LoopQaProjectState>;
};

const load = (): LoopQaStateFile =>
  readJson<LoopQaStateFile>(STATE_FILE, { by_autobiz_id: {}, projects: {} });
const save = (s: LoopQaStateFile) => writeJson(STATE_FILE, s);

export type CreateProjectInput = {
  project_id: string;
  base_url: string;
  design_document: string;
};

export type CreateProjectResult = {
  id: string;
  url: string;
  exploration_id: string;
};

function loopQaHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${env.REPLAY_API_KEY}`,
  };
}

function normalizeSeverity(raw: string): "blocker" | "major" | "minor" {
  const s = raw.toLowerCase();
  if (["blocker", "critical", "p0", "sev1", "high"].includes(s)) return "blocker";
  if (["major", "p1", "sev2", "medium"].includes(s)) return "major";
  return "minor";
}

// ─── Fixture-mode helpers ─────────────────────────────────────────────────────

function fixtureCreateProject(input: CreateProjectInput): CreateProjectResult {
  const s = load();
  const existingId = s.by_autobiz_id[input.project_id];
  if (existingId) {
    const proj = s.projects[existingId]!;
    // Add a new exploration for v2/v3 retry
    const idx = proj.explorations.length + 1;
    const exploration_id = `expl-${idx}`;
    proj.explorations.push({ id: exploration_id, index: idx, started_at: new Date().toISOString() });
    save(s);
    return { id: existingId, url: proj.dashboard_url, exploration_id };
  }
  const loop_qa_id = "fixture-lqa-1";
  const dashboard_url = "https://qa.replay.io/projects/fixture-run-1";
  const exploration_id = "expl-1";
  s.projects[loop_qa_id] = {
    loop_qa_project_id: loop_qa_id,
    autobiz_project_id: input.project_id,
    base_url: input.base_url,
    design_document: input.design_document,
    dashboard_url,
    explorations: [
      { id: exploration_id, index: 1, started_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
  };
  s.by_autobiz_id[input.project_id] = loop_qa_id;
  save(s);
  return { id: loop_qa_id, url: dashboard_url, exploration_id };
}

function fixtureStatus(loop_qa_id: string): {
  state: "queued" | "running" | "done" | "failed";
  journeys_passed_count: number;
  journeys_total: number;
  updated_at: string;
} {
  const s = load();
  const proj = s.projects[loop_qa_id];
  const explorations = proj?.explorations ?? [];
  const latest = explorations[explorations.length - 1];
  if (!latest) return { state: "queued", journeys_passed_count: 0, journeys_total: 0, updated_at: new Date().toISOString() };
  const ageMs = Date.now() - Date.parse(latest.started_at);
  if (ageMs < 6_000) {
    return {
      state: ageMs < 500 ? "queued" : "running",
      journeys_passed_count: 0,
      journeys_total: 4,
      updated_at: new Date().toISOString(),
    };
  }
  const bugs = latest.index === 1 ? readFixtureBugs(1).bugs : readFixtureBugs(2).bugs;
  const total = 4;
  const passed = total - bugs.length;
  if (!latest.finished_at) {
    latest.finished_at = new Date().toISOString();
    save(s);
  }
  return {
    state: "done",
    journeys_passed_count: passed,
    journeys_total: total,
    updated_at: latest.finished_at ?? new Date().toISOString(),
  };
}

type NormalizedBug = {
  id: string;
  severity: "blocker" | "major" | "minor";
  title: string;
  route: string;
  evidence_url: string;
  observed: string;
  expected: string;
  repro: string[];
};

function readFixtureBugs(run: 1 | 2): { bugs: NormalizedBug[] } {
  const path = run === 1 ? RUN1 : RUN2;
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    bugs: NormalizedBug[];
  };
  return { bugs: raw.bugs };
}

function fixtureBugsForProject(loop_qa_id: string): { bugs: NormalizedBug[] } {
  const s = load();
  const proj = s.projects[loop_qa_id];
  const latest = proj?.explorations[proj.explorations.length - 1];
  const run = latest?.index === 1 ? 1 : 2;
  const { bugs } = readFixtureBugs(run);
  return { bugs };
}

function fixtureBugDetail(bug_id: string): NormalizedBug | null {
  for (const run of [1, 2] as const) {
    const { bugs } = readFixtureBugs(run);
    const hit = bugs.find((b) => b.id === bug_id);
    if (hit) return hit;
  }
  return null;
}

function fixtureNewExploration(loop_qa_id: string): { exploration_id: string } {
  const s = load();
  const proj = s.projects[loop_qa_id];
  if (!proj) throw new Error("unknown loop-qa project");
  const idx = proj.explorations.length + 1;
  const id = `expl-${idx}`;
  proj.explorations.push({ id, index: idx, started_at: new Date().toISOString() });
  save(s);
  return { exploration_id: id };
}

// ─── Real-mode Loop QA proxies ────────────────────────────────────────────────

async function loopQaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${env.REPLAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...loopQaHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.warn(
      { path, status: res.status, key: maskLast4(env.REPLAY_API_KEY) },
      "loop-qa upstream non-2xx",
    );
    throw new Error(`loop-qa ${path} ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  if (env.FIXTURE_MODE) return fixtureCreateProject(input);

  const s = load();
  const existingId = s.by_autobiz_id[input.project_id];
  if (existingId) {
    // v2+: create a new exploration on the existing project. Real API wants a
    // {prompt} body and returns {id} (no exploration_id).
    const res = await loopQaFetch(`/projects/${existingId}/explorations`, {
      method: "POST",
      body: JSON.stringify({
        prompt: "Re-explore after code fixes; verify previously reported bugs are resolved.",
      }),
    });
    const data = (await res.json()) as { id?: string; exploration_id?: string };
    const proj = s.projects[existingId]!;
    const exploration_id = data.exploration_id ?? data.id ?? `expl-${proj.explorations.length + 1}`;
    proj.explorations.push({
      id: exploration_id,
      index: proj.explorations.length + 1,
      started_at: new Date().toISOString(),
    });
    save(s);
    return { id: existingId, url: proj.dashboard_url, exploration_id };
  }

  const res = await loopQaFetch("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.project_id,
      target_url: input.base_url,
      design_document: input.design_document,
    }),
  });
  const data = (await res.json()) as {
    id: string;
    url?: string;
    dashboard_url?: string;
    exploration_id?: string;
  };
  const dashboard_url = data.url ?? data.dashboard_url ?? `https://qa.replay.io/projects/${data.id}`;
  const exploration_id = data.exploration_id ?? "expl-1";
  s.projects[data.id] = {
    loop_qa_project_id: data.id,
    autobiz_project_id: input.project_id,
    base_url: input.base_url,
    design_document: input.design_document,
    dashboard_url,
    explorations: [{ id: exploration_id, index: 1, started_at: new Date().toISOString() }],
    created_at: new Date().toISOString(),
  };
  s.by_autobiz_id[input.project_id] = data.id;
  save(s);
  return { id: data.id, url: dashboard_url, exploration_id };
}

export async function getStatus(loop_qa_id: string) {
  if (env.FIXTURE_MODE) return fixtureStatus(loop_qa_id);
  const res = await loopQaFetch(`/projects/${loop_qa_id}/status`);
  // Real API returns a nested shape, e.g.
  // { project:{status}, bugs:{...}, journeys:{total}, test_runs:{"in-progress":N},
  //   explorations:{"in-progress":N} }
  const data = (await res.json()) as {
    project?: { status?: string };
    bugs?: unknown;
    journeys?: { total?: number };
    test_runs?: Record<string, number>;
    explorations?: Record<string, number>;
  };
  const inProgress =
    (data.explorations?.["in-progress"] ?? 0) + (data.test_runs?.["in-progress"] ?? 0);
  const rawState = data.project?.status?.toLowerCase() ?? "";
  const state: "queued" | "running" | "done" | "failed" =
    rawState === "failed"
      ? "failed"
      : inProgress > 0
        ? "running"
        : ["done", "complete", "completed", "ready"].includes(rawState)
          ? "done"
          : rawState === "queued"
            ? "queued"
            : "done";
  const journeys_total = data.journeys?.total ?? 0;
  const openBugs = countBugs(data.bugs);
  const journeys_passed_count = Math.max(0, journeys_total - openBugs);
  return {
    state,
    journeys_passed_count,
    journeys_total,
    updated_at: new Date().toISOString(),
  };
}

// The status payload's `bugs` field may be a count, an array, or an object keyed
// by severity/status. Sum whatever numeric leaves we can find; default to 0.
function countBugs(bugs: unknown): number {
  if (typeof bugs === "number") return bugs;
  if (Array.isArray(bugs)) return bugs.length;
  if (bugs && typeof bugs === "object") {
    let sum = 0;
    for (const v of Object.values(bugs as Record<string, unknown>)) {
      if (typeof v === "number") sum += v;
      else if (Array.isArray(v)) sum += v.length;
    }
    return sum;
  }
  return 0;
}

type LoopQaBugSummary = {
  id: string;
  severity: "blocker" | "major" | "minor";
  title: string;
  route: string;
  evidence_url: string;
};

export async function getBugs(loop_qa_id: string): Promise<{ bugs: LoopQaBugSummary[] }> {
  if (env.FIXTURE_MODE) {
    const { bugs } = fixtureBugsForProject(loop_qa_id);
    return {
      bugs: bugs.map((b) => ({
        id: b.id,
        severity: b.severity,
        title: b.title,
        route: b.route,
        evidence_url: b.evidence_url,
      })),
    };
  }
  // Real API paginates under `items`; keep `bugs` as a fallback for fixtures.
  const res = await loopQaFetch(`/projects/${loop_qa_id}/bugs?status=open&page=1&page_size=100`);
  const data = (await res.json()) as {
    items?: Array<{
      id: string;
      severity: string;
      title: string;
      route?: string;
      where?: string;
      evidence_url?: string;
      recording_url?: string;
    }>;
    bugs?: Array<{
      id: string;
      severity: string;
      title: string;
      route?: string;
      where?: string;
      evidence_url?: string;
      recording_url?: string;
    }>;
  };
  return {
    bugs: (data.items ?? data.bugs ?? []).map((b) => ({
      id: b.id,
      severity: normalizeSeverity(b.severity),
      title: b.title,
      route: b.route ?? b.where ?? "",
      evidence_url: b.evidence_url ?? b.recording_url ?? "",
    })),
  };
}

export async function getBugDetail(bug_id: string): Promise<NormalizedBug | null> {
  if (env.FIXTURE_MODE) return fixtureBugDetail(bug_id);
  const res = await loopQaFetch(`/bugs/${bug_id}`);
  const data = (await res.json()) as {
    id: string;
    severity: string;
    title: string;
    observed: string;
    expected: string;
    repro?: string[];
    steps?: string[];
    evidence_url?: string;
    recording_url?: string;
    route?: string;
    where?: string;
  };
  return {
    id: data.id,
    severity: normalizeSeverity(data.severity),
    title: data.title,
    observed: data.observed,
    expected: data.expected,
    repro: data.repro ?? data.steps ?? [],
    evidence_url: data.evidence_url ?? data.recording_url ?? "",
    route: data.route ?? data.where ?? "",
  };
}

export async function createExploration(
  loop_qa_id: string,
  regression_notes?: string,
): Promise<{ exploration_id: string }> {
  if (env.FIXTURE_MODE) return fixtureNewExploration(loop_qa_id);
  // Real API expects a {prompt} body and returns {id}.
  const res = await loopQaFetch(`/projects/${loop_qa_id}/explorations`, {
    method: "POST",
    body: JSON.stringify({
      prompt:
        regression_notes ??
        "Re-explore after code fixes; verify previously reported bugs are resolved.",
    }),
  });
  const data = (await res.json()) as { id?: string; exploration_id?: string };
  const exploration_id = data.exploration_id ?? data.id;
  if (!exploration_id) throw new Error("loop-qa did not return exploration id");
  const s = load();
  const proj = s.projects[loop_qa_id];
  if (proj) {
    proj.explorations.push({
      id: exploration_id,
      index: proj.explorations.length + 1,
      started_at: new Date().toISOString(),
    });
    save(s);
  }
  return { exploration_id };
}
