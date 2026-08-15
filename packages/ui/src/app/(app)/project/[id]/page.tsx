"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  BusinessState,
  DecisionRecord,
  ProjectStatus,
  TraceEvent,
} from "@autobiz/shared";
import { api } from "../../../../lib/api";
import { useProjectStream } from "../../../../hooks/useProjectStream";
import { AGENT_META, AgentLane, relativeTime } from "../../../../components/AgentLane";
import { pseudoQr } from "../../../../lib/qr";

function statusPill(status: ProjectStatus | undefined) {
  if (!status) return null;
  if (status === "live") {
    return (
      <span className="pill pill-live">
        <span className="dot dot-live" />
        LIVE
      </span>
    );
  }
  if (status === "error") return <span className="pill pill-error">ERROR</span>;
  if (status === "pivoting") return <span className="pill pill-pivot">PIVOTING</span>;
  return <span className="pill pill-planning">{status.toUpperCase()}</span>;
}

type LaneGroup = {
  key: string;
  agent: string;
  runId: string;
  events: TraceEvent[];
  order: number;
  version?: number;
};

function groupEvents(events: TraceEvent[]): LaneGroup[] {
  const groups = new Map<string, LaneGroup>();
  const runsPerAgent = new Map<string, string[]>();
  for (const e of events) {
    const key = `${e.agent}::${e.agent_run_id}`;
    let g = groups.get(key);
    if (!g) {
      const runs = runsPerAgent.get(e.agent) ?? [];
      if (!runs.includes(e.agent_run_id)) runs.push(e.agent_run_id);
      runsPerAgent.set(e.agent, runs);
      g = {
        key,
        agent: e.agent,
        runId: e.agent_run_id,
        events: [],
        order: groups.size,
        version: runs.length,
      };
      groups.set(key, g);
    }
    g.events.push(e);
  }
  // Only expose version when this agent has more than one run so far
  for (const g of groups.values()) {
    const runs = runsPerAgent.get(g.agent) ?? [];
    if (runs.length <= 1) g.version = undefined;
  }
  return Array.from(groups.values()).sort((a, b) => a.order - b.order);
}

function shipFixCycles(events: TraceEvent[]): Array<{ version: number; result: "bugs" | "clean" | "pending"; bugs?: number }> {
  const cycles: Array<{ version: number; result: "bugs" | "clean" | "pending"; bugs?: number }> = [];
  let builderCount = 0;
  let awaiting = false;
  for (const e of events) {
    if (e.agent === "builder" && e.type === "deploy") {
      builderCount += 1;
      cycles.push({ version: builderCount, result: "pending" });
      awaiting = true;
    } else if (e.agent === "replay-qa" && awaiting) {
      const last = cycles[cycles.length - 1];
      if (e.type === "bugs_found") {
        const md = (e.metadata as Record<string, unknown> | undefined) ?? {};
        const bugs = typeof md.bugs === "number" ? md.bugs : undefined;
        last.result = "bugs";
        last.bugs = bugs;
      } else if (e.type === "result" || e.type === "bugs_fixed") {
        if ((e.confidence ?? 1) >= 0.6 || e.type === "bugs_fixed") {
          last.result = "clean";
          awaiting = false;
        }
      }
    }
  }
  return cycles;
}

function ArrowRight({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { events, connected, error, lastId } = useProjectStream(projectId);
  const [business, setBusiness] = useState<BusinessState | null>(null);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [message, setMessage] = useState("");
  const [queued, setQueued] = useState<{ content: string; turn: number; ts: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [b, d] = await Promise.all([
        api.getBusiness(projectId),
        api.listDecisions(projectId).catch(() => [] as DecisionRecord[]),
      ]);
      setBusiness(b);
      setDecisions(d);
    } catch {
      /* stream is source of truth for progress; ignore */
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // Absorb pivot when we see the event.
  useEffect(() => {
    if (!queued) return;
    const absorbed = events.some(
      (e) => e.type === "pivot_absorbed" && new Date(e.ts).getTime() >= queued.ts,
    );
    if (absorbed) setQueued(null);
  }, [events, queued]);

  const lanes = useMemo(() => groupEvents(events), [events]);
  const cycles = useMemo(() => shipFixCycles(events), [events]);

  const agentsSeen = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.agent);
    return set.size;
  }, [events]);

  const currentTurn = useMemo(() => {
    let t = 0;
    for (const e of events) t = Math.max(t, e.turn ?? 0);
    return t;
  }, [events]);

  const elapsedMin = useMemo(() => {
    if (!business?.started_at) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(business.started_at).getTime()) / 60000));
  }, [business?.started_at]);

  const sendMessage = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const { queued_for_turn } = await api.postMessage(projectId, trimmed);
      setQueued({ content: trimmed, turn: queued_for_turn, ts: Date.now() });
      setMessage("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "failed to queue");
    } finally {
      setSending(false);
    }
  }, [message, projectId, sending]);

  const onMessageKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setMessage("");
        inputRef.current?.blur();
      } else if (e.key === "Enter") {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const goal = business?.goal ?? "loading…";
  const status = business?.status;

  return (
    <>
      {/* mini nav */}
      <div className="border-b divider">
        <div className="max-w-[1400px] mx-auto px-8 h-14 flex items-center gap-4">
          <Link href="/home" className="flex items-center gap-2 text-dim hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm">Projects</span>
          </Link>
          <div className="h-4 w-px surface-3" />
          <span className="text-sm font-medium truncate" title={goal}>{goal}</span>
          {status && <span className="ml-auto">{statusPill(status)}</span>}
          <div className="text-xs mono text-faint tabnum" title={projectId}>{projectId}</div>
        </div>
      </div>

      {/* pivot banner */}
      {queued && (
        <div className="border-b pivot-banner">
          <div className="max-w-[1400px] mx-auto px-8 py-3 flex items-center gap-4">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.35)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.2" aria-hidden>
                <path d="M8 3l-4 4 4 4M4 7h12a4 4 0 014 4M16 21l4-4-4-4M20 17H8a4 4 0 01-4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium" style={{ color: "#DDD6FE" }}>Pivot queued</span>
                <span className="pill pill-queued text-[10px]">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M12 6v6l4 2" />
                  </svg>
                  absorbing at turn {queued.turn}
                </span>
              </div>
              <div className="text-xs text-dim mono truncate">&quot;{queued.content}&quot;</div>
            </div>
            <div className="text-xs text-faint mono tabnum whitespace-nowrap">
              queued {relativeTime(new Date(queued.ts).toISOString())}
            </div>
            <button
              type="button"
              className="text-xs text-faint hover:text-white mono flex items-center gap-1"
              onClick={() => setQueued(null)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* status bar */}
      <div className="max-w-[1400px] mx-auto px-8 pt-6 pb-4">
        <div className="flex items-baseline gap-6 flex-wrap">
          <div>
            <div className="text-xs text-faint mono uppercase tracking-wider mb-1">Stripe balance</div>
            <div className="serif text-6xl tabnum flex items-baseline gap-1">
              <span className="text-white">${Math.floor(business?.stripe_balance_usd ?? 0)}</span>
              <span className="text-faint text-3xl">
                .{((business?.stripe_balance_usd ?? 0) % 1).toFixed(2).slice(2)}
              </span>
            </div>
          </div>
          <div className="text-xs text-faint mono flex items-center gap-3">
            <span>{business?.charges_count ?? 0} charge{business?.charges_count === 1 ? "" : "s"}</span>
            {business?.bugs_open ? (
              <>
                <span>·</span>
                <span style={{ color: "#FB7185" }}>{business.bugs_open} bug{business.bugs_open === 1 ? "" : "s"}</span>
              </>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-6 text-sm text-dim flex-wrap">
            <div><span className="text-white font-semibold tabnum">{agentsSeen}</span> agents</div>
            <div><span className="text-white font-semibold tabnum">{business?.decisions_count ?? decisions.length}</span> decisions</div>
            {business && (
              <div>
                <span
                  className={`font-semibold tabnum ${business.uptime_pct >= 99 ? "text-emerald-400" : "text-white"}`}
                >
                  {business.uptime_pct.toFixed(business.uptime_pct === 100 ? 0 : 1)}%
                </span>{" "}
                uptime
              </div>
            )}
            <div className="text-xs mono text-faint">
              turn <span className="text-white tabnum">{currentTurn}</span>
              {" · "}
              <span className="tabnum">{elapsedMin}m</span> elapsed
            </div>
          </div>
        </div>
      </div>

      {/* main grid */}
      <div className="max-w-[1400px] mx-auto px-8 pb-16 grid grid-cols-12 gap-6">
        {/* left */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-dim">Agent Traces</h2>
            <div className="flex-1 h-px divider border-t" />
            <div className="flex items-center gap-2 text-xs mono text-faint">
              <div className={`dot ${connected ? "dot-live" : ""}`} style={connected ? undefined : { background: "#6B6B72" }} />
              <span>{connected ? "streaming · SSE" : error ? "reconnecting…" : "connecting…"} · #{lastId}</span>
            </div>
          </div>

          {error && !connected && (
            <div className="text-xs mono" style={{ color: "#FB7185" }}>{error}</div>
          )}

          <div className="space-y-5">
            {lanes.length === 0 ? (
              <div className="text-xs text-faint mono">Waiting for first agent event…</div>
            ) : (
              lanes.map((lane) => (
                <AgentLane
                  key={lane.key}
                  agent={lane.agent}
                  runId={lane.runId}
                  events={lane.events}
                  builderVersion={lane.agent === "builder" ? lane.version : undefined}
                />
              ))
            )}
          </div>
        </div>

        {/* right */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Business */}
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-sm font-semibold tracking-widest uppercase text-dim">Business</h3>
              {statusPill(status)}
            </div>
            <div className="serif text-3xl mb-1 break-words">{business?.goal ?? goal}</div>
            {business?.landing_url ? (
              <div className="flex items-center gap-3 text-sm mb-5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" aria-hidden>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
                <a
                  className="mono text-sm hover:underline truncate"
                  style={{ color: "#C4B5FD", maxWidth: "24ch" }}
                  href={business.landing_url}
                  target="_blank"
                  rel="noreferrer"
                  title={business.landing_url}
                >
                  {business.landing_url.replace(/^https?:\/\//, "")}
                </a>
                <button
                  type="button"
                  className="text-xs text-faint hover:text-white ml-auto flex items-center gap-1"
                  onClick={() => {
                    if (business.landing_url) navigator.clipboard?.writeText(business.landing_url);
                  }}
                >
                  copy
                </button>
              </div>
            ) : (
              <div className="text-sm text-dim mb-5">landing not deployed yet</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="surface-2 border divider rounded-lg p-4 flex items-center justify-center">
                <div className="qr-grid" aria-label="QR placeholder">
                  {pseudoQr(projectId).map((on, i) => (
                    <span key={i} className={on ? "on" : ""} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-faint mono uppercase tracking-wider mb-1">Scan</div>
                <div className="serif text-3xl tabnum mb-1">
                  ${(business?.stripe_balance_usd ?? 0).toFixed(2)}
                </div>
                <div className="text-xs text-dim mb-3">balance</div>
                <div className="text-xs mono text-faint space-y-1">
                  <div>· {business?.charges_count ?? 0} charges</div>
                  <div>· {business?.errors_last_5m ?? 0} errors 5m</div>
                  <div>· p95 <span className="tabnum">{business?.p95_latency_ms ?? 0}ms</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Decisions */}
          {decisions.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold tracking-widest uppercase text-dim">Decisions from Terac</h3>
                <div className="flex-1 h-px divider border-t" />
                <span className="text-xs mono text-faint tabnum">
                  {decisions.length} decision{decisions.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-4">
                {decisions.map((d, i) => (
                  <DecisionCard key={d.decision_id} decision={d} highlight={i === 0} />
                ))}
              </div>
            </div>
          )}

          {/* Ship & fix */}
          {cycles.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-sm font-semibold tracking-widest uppercase text-dim">Ship &amp; fix loop</h3>
                <div className="flex-1 h-px divider border-t" />
                <span className="text-xs mono text-faint tabnum">
                  {cycles.length} cycle{cycles.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-2 mono text-xs">
                {cycles.map((c) => (
                  <div key={c.version} className="flex items-center gap-2 surface-2 rounded p-2">
                    <span className="pill pill-fix text-[10px]">v{c.version}</span>
                    <span className="text-dim">Builder deployed</span>
                    <ArrowRight size={10} className="text-faint" />
                    <span className="text-dim">Replay QA</span>
                    {c.result === "bugs" && (
                      <span className="pill pill-bug text-[10px] ml-auto">
                        {c.bugs ? `${c.bugs} bug${c.bugs === 1 ? "" : "s"}` : "bugs"}
                      </span>
                    )}
                    {c.result === "clean" && (
                      <span className="pill pill-high text-[10px] ml-auto">clean</span>
                    )}
                    {c.result === "pending" && (
                      <span className="pill text-[10px] ml-auto pill-planning">running</span>
                    )}
                  </div>
                ))}
                {business && (
                  <div className="flex items-center gap-2 pt-2 text-xs text-faint">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" aria-hidden>
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                    <span>
                      ServiceWatcher · uptime{" "}
                      <span className="tabnum">{business.uptime_pct.toFixed(0)}%</span> ·{" "}
                      <span className="tabnum">{business.p95_latency_ms}ms</span> p95 ·{" "}
                      <span className="tabnum">{business.errors_last_5m}</span> errors 5m
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Memory link */}
          <Link
            href={`/project/${encodeURIComponent(projectId)}/memory`}
            className="card card-hover p-4 flex items-center gap-3 transition-colors"
          >
            <div
              className="h-9 w-9 rounded-md surface-2 flex items-center justify-center shrink-0"
              style={{ border: "1px solid var(--border)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" aria-hidden>
                <path d="M4 4h6l2 2h8a2 2 0 012 2v9a3 3 0 01-3 3H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Agent Memory</div>
              <div className="text-xs text-faint mono">markdown scratchpad — persists across turns</div>
            </div>
            <ArrowRight className="text-faint" />
          </Link>

          {/* Pivot input */}
          <div className="card p-3">
            <div className="text-xs text-faint mono uppercase tracking-wider mb-2 px-2 pt-1">
              Message the project
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={onMessageKey}
                placeholder="Pivot, add a constraint, or ask a question…"
                className="flex-1 bg-transparent outline-none text-sm py-2 px-2 placeholder:text-faint"
              />
              <button
                type="button"
                className="px-3 py-1.5 text-xs rounded-md accent-bg text-white font-medium disabled:opacity-50"
                onClick={sendMessage}
                disabled={sending || !message.trim()}
              >
                {sending ? "Queueing…" : "Queue"}
              </button>
            </div>
            <div className="text-xs text-faint mono px-2 pb-1 pt-1">
              absorbed at next turn boundary · won&apos;t kill running work
            </div>
            {sendError && (
              <div className="text-xs mono px-2 pb-1" style={{ color: "#FB7185" }}>{sendError}</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ConfBar({ value, tone }: { value: number; tone: "before" | "after" }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 conf-bar">
        <div className="conf-fill" style={{ width: `${pct}%` }} />
      </div>
      <span
        className="text-xs mono tabnum"
        style={{ color: tone === "before" ? "#FB7185" : "#34D399" }}
      >
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function decisionValueText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function DecisionCard({ decision, highlight }: { decision: DecisionRecord; highlight: boolean }) {
  const beforeText = decisionValueText(decision.before.value);
  const afterText = decisionValueText(decision.after.value);
  return (
    <div className={`card p-5 ${highlight ? "shimmer-border" : ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="pill pill-terac">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          {decision.topic}
        </span>
        <span className="text-xs mono text-faint ml-auto tabnum" title={decision.ts}>
          {relativeTime(decision.ts)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
        <div className="glass-before strike-diag rounded-lg p-3">
          <div className="text-xs text-faint mono mb-2 uppercase tracking-wider">Before</div>
          <div className="mono text-sm mb-2 line-through text-dim break-words">{beforeText || "—"}</div>
          <div className="text-xs text-dim mb-2 line-clamp-3">{decision.before.reasoning}</div>
          <ConfBar value={decision.before.confidence} tone="before" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <div
            className="h-8 w-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.35)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2.2" aria-hidden>
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <ArrowRight size={20} className="text-violet-300" />
        </div>

        <div className="glass-after rounded-lg p-3">
          <div className="text-xs mono mb-2 uppercase tracking-wider" style={{ color: "#34D399" }}>
            After · Terac validated
          </div>
          <div className="mono text-sm font-semibold mb-2 break-words" style={{ color: "#6EE7B7" }}>
            {afterText || "—"}
          </div>
          <div className="text-xs text-dim mb-2 line-clamp-3">{decision.after.reasoning}</div>
          <ConfBar value={decision.after.confidence} tone="after" />
        </div>
      </div>

      {decision.aggregate && (
        <div className="mt-3 text-xs text-faint mono line-clamp-2">{decision.aggregate}</div>
      )}
    </div>
  );
}

// Suppress unused-var warning: AGENT_META is available for downstream imports.
void AGENT_META;
