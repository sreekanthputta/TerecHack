import type { TraceEventInput, DecisionRecord, BusinessPlan } from "@autobiz/shared";

export type OrchClient = {
  postEvent(event: TraceEventInput): Promise<void>;
  postDecision(dec: DecisionRecord): Promise<void>;
  postPlan(plan: BusinessPlan): Promise<void>;
  postMemory(payload: { path: string; content: string }): Promise<void>;
};

export function makeOrchClient(orchUrl: string, turnId: string): OrchClient {
  const url = (p: string) => `${orchUrl}/internal/turns/${turnId}${p}`;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(url(path), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  };
  return {
    postEvent: (e) => post("/events", e),
    postDecision: (d) => post("/decisions", d),
    postPlan: (p) => post("/plan", p),
    postMemory: (m) => post("/memory", m),
  };
}
