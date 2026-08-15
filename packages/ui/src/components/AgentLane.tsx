import type { AgentName, TraceEvent } from "@autobiz/shared";

type LaneKey =
  | "lane-planner"
  | "lane-researcher"
  | "lane-verifier"
  | "lane-builder"
  | "lane-replay"
  | "lane-cron"
  | "lane-user";

export const AGENT_META: Record<
  string,
  { label: string; color: string; lane: LaneKey }
> = {
  planner: { label: "Planner", color: "#7DD3FC", lane: "lane-planner" },
  researcher: { label: "Researcher", color: "#DDD6FE", lane: "lane-researcher" },
  verifier: { label: "Verifier", color: "#F5D0FE", lane: "lane-verifier" },
  builder: { label: "Builder", color: "#FCD34D", lane: "lane-builder" },
  "replay-qa": { label: "Replay QA", color: "#A5F3FC", lane: "lane-replay" },
  revenue_watcher: {
    label: "RevenueWatcher",
    color: "#6EE7B7",
    lane: "lane-cron",
  },
  service_watcher: {
    label: "ServiceWatcher",
    color: "#6EE7B7",
    lane: "lane-cron",
  },
  orchestrator: { label: "Orchestrator", color: "#C4B5FD", lane: "lane-planner" },
};

export function laneFor(agent: AgentName | string) {
  return AGENT_META[agent] ?? { label: agent, color: "#E8E8EA", lane: "lane-planner" as LaneKey };
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function typePillClass(type: string): string {
  switch (type) {
    case "bugs_found":
    case "error":
      return "pill-bug";
    case "bugs_fixed":
    case "deploy":
      return "pill-fix";
    case "sale":
    case "result":
    case "health_check":
      return "pill-high";
    case "terac_call":
    case "terac_result":
      return "pill-terac";
    default:
      return "pill-available";
  }
}

type Props = {
  agent: string;
  runId: string;
  events: TraceEvent[];
  builderVersion?: number;
};

export function AgentLane({ agent, events, builderVersion }: Props) {
  const meta = laneFor(agent);
  const first = events[0];
  const hasBuilderVersion = agent === "builder" && builderVersion !== undefined;
  return (
    <div className={`agent-lane ${meta.lane}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold" style={{ color: meta.color }}>
          {meta.label}
        </span>
        <span className="text-xs mono text-faint">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
        {hasBuilderVersion && (
          <span className="pill pill-fix">v{builderVersion}</span>
        )}
        {first?.metadata && typeof (first.metadata as Record<string, unknown>).source === "string" && (
          <span className="text-xs mono text-faint">
            · {(first.metadata as Record<string, string>).source}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {events.map((e) => (
          <TraceEventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}

function TraceEventCard({ event }: { event: TraceEvent }) {
  const isBug = event.type === "bugs_found";
  const isGreen =
    event.type === "bugs_fixed" ||
    event.type === "sale" ||
    (event.type === "result" && (event.confidence ?? 0) >= 0.6);
  const cardStyle: React.CSSProperties = isBug
    ? {
        borderColor: "rgba(244,63,94,0.25)",
        background: "linear-gradient(180deg,rgba(244,63,94,0.04),transparent 60%)",
      }
    : {};

  return (
    <div className="card p-3 text-sm" style={cardStyle}>
      <div className="flex items-center gap-2 mb-1 text-xs text-faint mono">
        <span
          className={`pill ${typePillClass(event.type)} text-[10px]`}
          style={
            isGreen && event.type !== "sale"
              ? { color: "#34D399", background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)" }
              : undefined
          }
        >
          {event.type}
        </span>
        {typeof event.confidence === "number" && (
          <span
            className={`pill text-[10px] ${event.confidence >= 0.6 ? "pill-high" : "pill-low"}`}
          >
            conf {event.confidence.toFixed(2)}
          </span>
        )}
        <span className="ml-auto tabnum" title={event.ts}>
          {relativeTime(event.ts)}
        </span>
      </div>
      <div className="whitespace-pre-wrap break-words">{event.content}</div>
      {typeof event.confidence === "number" && event.type === "result" && (
        <div className="mt-2">
          <div className="conf-bar">
            <div className="conf-fill" style={{ width: `${Math.round(event.confidence * 100)}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}
