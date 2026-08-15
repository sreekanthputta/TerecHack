import type { TraceEventInput, BusinessStatePatch } from "@autobiz/shared";

export type BaseFields = {
  project_id: string;
  turn: number;
  agent: "builder";
  agent_run_id: string;
};

export class OrchClient {
  constructor(
    private readonly orchUrl: string,
    private readonly turnId: string,
    private readonly base: BaseFields,
  ) {}

  private now(): string {
    return new Date().toISOString();
  }

  async event(
    partial: Omit<TraceEventInput, "project_id" | "turn" | "agent" | "agent_run_id" | "ts"> &
      Partial<Pick<TraceEventInput, "ts">>,
  ): Promise<void> {
    const body: TraceEventInput = {
      ...this.base,
      ts: partial.ts ?? this.now(),
      ...partial,
    } as TraceEventInput;
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST event failed: ${res.status} ${await res.text()}`);
  }

  async state(patch: BusinessStatePatch): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...patch, updated_at: this.now() }),
    });
    if (!res.ok) throw new Error(`POST state failed: ${res.status}`);
  }

  async memory(path: string, content: string): Promise<void> {
    const res = await fetch(`${this.orchUrl}/internal/turns/${this.turnId}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`POST memory failed: ${res.status}`);
  }
}
