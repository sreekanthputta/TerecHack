import type {
  BusinessState,
  DecisionRecord,
  TraceEvent,
  PluginDescriptor,
  PluginConfig,
} from "@autobiz/shared";

export const ORCHESTRATOR_URL =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:4000";

type MemoryFile = {
  path: string;
  size: number;
  updated_at: string;
  agent?: string;
  content?: string;
};

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ORCHESTRATOR_URL}${input}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${input} — ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export function newIdempotencyKey(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return rand;
}

export const api = {
  listBusinesses(): Promise<BusinessState[]> {
    return jsonFetch<BusinessState[]>("/api/businesses");
  },
  getBusiness(id: string): Promise<BusinessState> {
    return jsonFetch<BusinessState>(`/api/business/${encodeURIComponent(id)}`);
  },
  createBusiness(input: {
    idea: string;
    owner_contact?: string;
    idempotency_key: string;
  }): Promise<{ project_id: string }> {
    return jsonFetch<{ project_id: string }>("/api/business", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  listEvents(id: string, since?: number, limit = 200): Promise<TraceEvent[]> {
    const q = new URLSearchParams();
    if (since !== undefined) q.set("since", String(since));
    q.set("limit", String(limit));
    return jsonFetch<TraceEvent[]>(
      `/api/business/${encodeURIComponent(id)}/events?${q.toString()}`,
    );
  },
  listDecisions(id: string): Promise<DecisionRecord[]> {
    return jsonFetch<DecisionRecord[]>(`/api/business/${encodeURIComponent(id)}/decisions`);
  },
  listMemory(id: string): Promise<{ files: MemoryFile[] }> {
    return jsonFetch<{ files: MemoryFile[] }>(`/api/business/${encodeURIComponent(id)}/memory`);
  },
  postMessage(id: string, content: string): Promise<{ queued_for_turn: number }> {
    return jsonFetch<{ queued_for_turn: number }>(
      `/api/business/${encodeURIComponent(id)}/message`,
      { method: "POST", body: JSON.stringify({ content }) },
    );
  },
  listPlugins(): Promise<PluginDescriptor[]> {
    return jsonFetch<PluginDescriptor[]>("/api/plugins");
  },
  listPluginConfigs(): Promise<PluginConfig[]> {
    return jsonFetch<PluginConfig[]>("/api/plugins/config");
  },
  putPluginConfig(pluginId: string, config: Record<string, unknown>): Promise<PluginConfig> {
    return jsonFetch<PluginConfig>(
      `/api/plugins/${encodeURIComponent(pluginId)}/config`,
      { method: "PUT", body: JSON.stringify(config) },
    );
  },
  deletePluginConfig(pluginId: string): Promise<void> {
    return jsonFetch<void>(`/api/plugins/${encodeURIComponent(pluginId)}/config`, {
      method: "DELETE",
    });
  },
};

export type { MemoryFile };
