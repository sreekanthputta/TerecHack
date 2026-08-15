import type { AgentContext, TraceEventInput, TraceEventType } from "@autobiz/shared";

export type EmitPartial = {
  type: TraceEventType;
  content: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
};

export type Emitter = (partial: EmitPartial) => Promise<void>;

export function makeEmitter(ctx: AgentContext): Emitter {
  const orchUrl = ctx.env.orchestrator_url;
  const turnId = ctx.turn_id;
  const base = {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: "planner" as const,
    agent_run_id: ctx.agent_run_id,
  };

  return async (partial) => {
    const event: TraceEventInput = {
      ...base,
      type: partial.type,
      content: partial.content.length > 500 ? partial.content.slice(0, 497) + "..." : partial.content,
      ts: new Date().toISOString(),
      ...(partial.confidence !== undefined ? { confidence: partial.confidence } : {}),
      ...(partial.metadata ? { metadata: partial.metadata } : {}),
    };
    const res = await fetch(`${orchUrl}/internal/turns/${turnId}/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`POST event failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
  };
}

export async function postPlan(orchUrl: string, turnId: string, plan: unknown): Promise<void> {
  const res = await fetch(`${orchUrl}/internal/turns/${turnId}/plan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error(`POST plan failed: ${res.status}`);
}

export async function postMemory(orchUrl: string, turnId: string, path: string, content: string): Promise<void> {
  const res = await fetch(`${orchUrl}/internal/turns/${turnId}/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) throw new Error(`POST memory failed: ${res.status}`);
}
