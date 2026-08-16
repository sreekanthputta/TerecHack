import type { AgentName, BugReport, BusinessStatePatch, TraceEventInput } from "@autobiz/shared";

export type AgentBase = {
  project_id: string;
  turn: number;
  agent: Exclude<AgentName, "orchestrator">;
  agent_run_id: string;
};

export class OrchestratorClient {
  constructor(
    private readonly baseUrl: string,
    private readonly turnId: string,
    private readonly base: AgentBase,
  ) {}

  private now(): string {
    return new Date().toISOString();
  }

  event(
    type: TraceEventInput["type"],
    content: string,
    extra: { metadata?: Record<string, unknown>; confidence?: number } = {},
  ): Promise<void> {
    const body: TraceEventInput = {
      ...this.base,
      type,
      content: content.slice(0, 500),
      ts: this.now(),
      ...(extra.metadata ? { metadata: extra.metadata } : {}),
      ...(typeof extra.confidence === "number" ? { confidence: extra.confidence } : {}),
    };
    return this.post(`/internal/turns/${this.turnId}/events`, body);
  }

  bugs(report: BugReport): Promise<void> {
    return this.post(`/internal/turns/${this.turnId}/bugs`, report);
  }

  state(patch: BusinessStatePatch): Promise<void> {
    return this.post(`/internal/turns/${this.turnId}/state`, patch);
  }

  memory(path: string, content: string): Promise<void> {
    return this.post(`/internal/turns/${this.turnId}/memory`, { path, content });
  }

  private async post(pathname: string, body: unknown): Promise<void> {
    const res = await fetch(`${this.baseUrl}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`POST ${pathname} failed: ${res.status}`);
    }
  }
}
