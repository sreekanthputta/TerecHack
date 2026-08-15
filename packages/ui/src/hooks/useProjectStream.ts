"use client";

import { useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { TraceEvent } from "@autobiz/shared";
import { ORCHESTRATOR_URL, api } from "../lib/api";

type State = {
  events: TraceEvent[];
  connected: boolean;
  error: string | null;
  lastId: number;
};

function dedupSortAppend(prev: TraceEvent[], incoming: TraceEvent[]): TraceEvent[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((e) => e.id));
  const merged = prev.slice();
  for (const e of incoming) {
    if (!seen.has(e.id)) {
      merged.push(e);
      seen.add(e.id);
    }
  }
  merged.sort((a, b) => a.id - b.id);
  return merged;
}

export function useProjectStream(projectId: string): State {
  const [state, setState] = useState<State>({
    events: [],
    connected: false,
    error: null,
    lastId: 0,
  });
  const lastIdRef = useRef(0);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      try {
        const history = await api.listEvents(projectId, 0, 500);
        if (cancelled) return;
        const last = history.reduce((m, e) => (e.id > m ? e.id : m), 0);
        lastIdRef.current = last;
        setState((s) => ({
          ...s,
          events: dedupSortAppend(s.events, history),
          lastId: last,
        }));
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({ ...s, error: e instanceof Error ? e.message : "history failed" }));
        }
      }

      if (cancelled) return;

      const url = `${ORCHESTRATOR_URL}/api/business/${encodeURIComponent(projectId)}/stream`;
      fetchEventSource(url, {
        signal: controller.signal,
        openWhenHidden: true,
        headers: lastIdRef.current
          ? { "Last-Event-ID": String(lastIdRef.current) }
          : undefined,
        async onopen(res) {
          if (res.ok && res.headers.get("content-type")?.includes("text/event-stream")) {
            setState((s) => ({ ...s, connected: true, error: null }));
            try {
              const backfill = await api.listEvents(projectId, lastIdRef.current, 500);
              if (backfill.length > 0 && !cancelled) {
                const last = backfill.reduce(
                  (m, e) => (e.id > m ? e.id : m),
                  lastIdRef.current,
                );
                lastIdRef.current = last;
                setState((s) => ({
                  ...s,
                  events: dedupSortAppend(s.events, backfill),
                  lastId: last,
                }));
              }
            } catch {
              /* ignore backfill errors — live stream will fill in */
            }
            return;
          }
          throw new Error(`stream open ${res.status}`);
        },
        onmessage(ev) {
          if (!ev.data || ev.event === "ping") return;
          try {
            const parsed = JSON.parse(ev.data) as TraceEvent;
            if (typeof parsed.id !== "number") return;
            if (parsed.id <= lastIdRef.current) return;
            lastIdRef.current = parsed.id;
            setState((s) => ({
              ...s,
              events: dedupSortAppend(s.events, [parsed]),
              lastId: parsed.id,
            }));
          } catch {
            /* malformed event; ignore */
          }
        },
        onerror(err) {
          setState((s) => ({
            ...s,
            connected: false,
            error: err instanceof Error ? err.message : "stream error",
          }));
          // let fetchEventSource retry
        },
        onclose() {
          setState((s) => ({ ...s, connected: false }));
          throw new Error("closed");
        },
      }).catch(() => {
        /* aborted or terminal */
      });
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [projectId]);

  return state;
}
