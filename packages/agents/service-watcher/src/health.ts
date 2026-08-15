import type { IntClient } from "./http.js";
import { appendTick, type HealthTick, type WatcherState } from "./state.js";

export type HealthReading = {
  status: "healthy" | "degraded" | "down";
  latency_ms: number;
  checked_at: string;
};

/**
 * Fetch a live health reading from integrations. `errors` field is filled in by
 * the log scan pass; here we default to 0.
 */
export async function checkLive(client: IntClient, projectId: string): Promise<HealthReading> {
  return client.health(projectId);
}

export function toTick(reading: HealthReading, errors = 0): HealthTick {
  return {
    ts: reading.checked_at,
    status: reading.status,
    latency_ms: reading.latency_ms,
    errors,
  };
}

export function record(state: WatcherState, tick: HealthTick): WatcherState {
  return appendTick(state, tick);
}
