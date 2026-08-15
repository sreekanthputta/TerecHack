import type { AgentContext, TraceEventInput, TraceEventType } from "@autobiz/shared";

type Base = Pick<TraceEventInput, "project_id" | "turn" | "agent" | "agent_run_id">;

export type Emit = (ev: {
  type: TraceEventType;
  content: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}) => Promise<void>;

export type MemoryWrite = (path: string, content: string) => Promise<void>;

export function baseFrom(ctx: AgentContext): Base {
  return {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: "researcher",
    agent_run_id: ctx.agent_run_id,
  };
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function makeEmitter(orchUrl: string, turnId: string, base: Base): Emit {
  return async (ev) => {
    const body: TraceEventInput = {
      ...base,
      type: ev.type,
      content: truncate(ev.content, 500),
      ts: new Date().toISOString(),
      ...(ev.confidence !== undefined ? { confidence: ev.confidence } : {}),
      ...(ev.metadata ? { metadata: ev.metadata } : {}),
    };
    const res = await fetch(`${orchUrl}/internal/turns/${turnId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST /events ${res.status}: ${await res.text().catch(() => "")}`);
  };
}

export function makeMemoryWriter(orchUrl: string, turnId: string): MemoryWrite {
  return async (path, content) => {
    const res = await fetch(`${orchUrl}/internal/turns/${turnId}/memory`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error(`POST /memory ${res.status}: ${await res.text().catch(() => "")}`);
  };
}
