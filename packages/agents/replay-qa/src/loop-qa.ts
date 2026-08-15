import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type LoopQaProject = {
  id: string;
  dashboard_url: string;
  exploration_id: string;
};

export type LoopQaStatus = {
  done: boolean;
  journeys_covered: number;
  journeys_passed_count: number;
  journeys_failed_count: number;
  explored_at?: string;
};

export type LoopQaBugRef = {
  loop_qa_bug_id: string;
  severity: "blocker" | "major" | "minor";
  route: string;
  component: string;
  finding_summary: string;
  expected_behavior: string;
  repro_steps: string[];
  evidence_url: string;
};

export type LoopQaFixture = {
  project: LoopQaProject;
  status: LoopQaStatus;
  bugs: LoopQaBugRef[];
};

export type LoopQaClient = {
  createProject(input: {
    name: string;
    base_url: string;
    design_document: string;
  }): Promise<LoopQaProject>;
  startExploration(projectId: string): Promise<{ exploration_id: string }>;
  pollStatus(projectId: string): AsyncGenerator<LoopQaStatus, LoopQaStatus, void>;
  listBugs(projectId: string): Promise<LoopQaBugRef[]>;
  getBugDetail(bugId: string): Promise<LoopQaBugRef>;
};

/**
 * HTTP client that talks to integrations at `${baseUrl}/replay/*`. 5xx responses
 * are retried once before surfacing an error.
 */
export function createHttpClient(baseUrl: string, pollIntervalMs = 5000, timeoutMs = 180_000): LoopQaClient {
  async function once(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
    return fetch(`${baseUrl}${path}`, {
      method,
      ...(body !== undefined
        ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
        : {}),
    });
  }
  async function req<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    let res = await once(method, path, body);
    if (res.status >= 500 && res.status < 600) {
      await new Promise((r) => setTimeout(r, 250));
      res = await once(method, path, body);
    }
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }
  const get = <T>(path: string) => req<T>("GET", path);
  const post = <T>(path: string, body: unknown) => req<T>("POST", path, body);
  return {
    async createProject(input) {
      return post<LoopQaProject>(`/replay/project`, input);
    },
    async startExploration(projectId) {
      return post<{ exploration_id: string }>(`/replay/project/${projectId}/explorations`, {});
    },
    async *pollStatus(projectId) {
      const deadline = Date.now() + timeoutMs;
      let last: LoopQaStatus | undefined;
      while (Date.now() < deadline) {
        const status = await get<LoopQaStatus>(`/replay/project/${projectId}/status`);
        yield status;
        last = status;
        if (status.done) return status;
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }
      throw new Error("loop-qa poll timeout");
    },
    async listBugs(projectId) {
      return get<LoopQaBugRef[]>(`/replay/project/${projectId}/bugs`);
    },
    async getBugDetail(bugId) {
      return get<LoopQaBugRef>(`/replay/bugs/${bugId}`);
    },
  };
}

/**
 * Fixture-mode client: reads run-{N}-*.json shipped inside this package. Emulates a
 * short 3-poll exploration so demos feel real without racing the contract tests.
 */
export function createFixtureClient(runNumber: number): LoopQaClient {
  const fixturePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "fixtures",
    runNumber === 1 ? "run-1-bugs.json" : "run-2-green.json",
  );
  const loadFixture = async (): Promise<LoopQaFixture> => {
    const raw = await readFile(fixturePath, "utf8");
    return JSON.parse(raw) as LoopQaFixture;
  };
  const pollDelayMs = Number(process.env.FIXTURE_POLL_MS ?? "150");
  const pollCount = Number(process.env.FIXTURE_POLL_COUNT ?? "2");
  return {
    async createProject(_input) {
      const f = await loadFixture();
      return f.project;
    },
    async startExploration(_projectId) {
      const f = await loadFixture();
      return { exploration_id: f.project.exploration_id };
    },
    async *pollStatus(_projectId) {
      const f = await loadFixture();
      for (let i = 0; i < pollCount; i++) {
        await new Promise((r) => setTimeout(r, pollDelayMs));
        yield {
          done: false,
          journeys_covered: Math.max(1, Math.floor((f.status.journeys_covered / pollCount) * (i + 1))),
          journeys_passed_count: 0,
          journeys_failed_count: 0,
        };
      }
      await new Promise((r) => setTimeout(r, pollDelayMs));
      yield f.status;
      return f.status;
    },
    async listBugs(_projectId) {
      const f = await loadFixture();
      return f.bugs;
    },
    async getBugDetail(bugId) {
      const f = await loadFixture();
      const hit = f.bugs.find((b) => b.loop_qa_bug_id === bugId);
      if (!hit) throw new Error(`fixture missing bug ${bugId}`);
      return hit;
    },
  };
}
