import type { TraceEventInput } from "@autobiz/shared";

export type EventBase = {
  project_id: string;
  turn: number;
  agent: "service-watcher";
  agent_run_id: string;
};

export class OrchClient {
  constructor(
    private readonly orchUrl: string,
    private readonly turnId: string,
  ) {}

  async postEvent(event: TraceEventInput): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`POST event failed: ${res.status}`);
  }

  async postBugs(report: unknown): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/bugs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
    });
    if (!res.ok) throw new Error(`POST bugs failed: ${res.status}`);
  }

  async postState(patch: unknown): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`POST state failed: ${res.status}`);
  }

  async postMemory(write: unknown): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(write),
    });
    if (!res.ok) throw new Error(`POST memory failed: ${res.status}`);
  }
}

export class IntClient {
  constructor(private readonly intUrl: string) {}

  async health(projectId: string): Promise<{
    status: "healthy" | "degraded" | "down";
    latency_ms: number;
    checked_at: string;
  }> {
    const res = await fetch(`${this.intUrl}/render/health/${projectId}`);
    if (!res.ok) throw new Error(`GET /render/health failed: ${res.status}`);
    return (await res.json()) as {
      status: "healthy" | "degraded" | "down";
      latency_ms: number;
      checked_at: string;
    };
  }

  async logs(projectId: string, since: string | null, limit = 50): Promise<{ lines: string[] }> {
    const params = new URLSearchParams();
    if (since) params.set("since", since);
    params.set("limit", String(limit));
    const res = await fetch(`${this.intUrl}/render/logs/${projectId}?${params.toString()}`);
    if (!res.ok) throw new Error(`GET /render/logs failed: ${res.status}`);
    return (await res.json()) as { lines: string[] };
  }

  async linqNotify(payload: unknown): Promise<void> {
    // Best-effort. Integration stub may not exist — swallow failure.
    try {
      await fetch(`${this.intUrl}/linq/notify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* best-effort */
    }
  }
}
