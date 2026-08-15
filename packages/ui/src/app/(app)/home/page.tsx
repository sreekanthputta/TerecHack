"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { BusinessState, ProjectStatus } from "@autobiz/shared";
import { api, newIdempotencyKey } from "../../../lib/api";

const EXAMPLES = [
  "a friend's ceramic mug shop",
  "a subscription for hand-poured candles",
  "a restaurant delivery site for Tandoori Palace",
  "a resume-roasting service for job seekers",
];

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function statusPill(status: ProjectStatus) {
  if (status === "live") {
    return (
      <span className="pill pill-live">
        <span className="dot-live" />
        LIVE
      </span>
    );
  }
  if (status === "error") {
    return <span className="pill pill-error">ERROR</span>;
  }
  if (status === "pivoting") {
    return <span className="pill pill-pivot">PIVOTING</span>;
  }
  const label = status.toUpperCase();
  return (
    <span className="pill pill-planning">
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
        <path d="M12 6v6l4 2" />
      </svg>
      {label}
    </span>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [projects, setProjects] = useState<BusinessState[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idempKeyRef = useRef<string>(newIdempotencyKey());

  const refresh = useCallback(async () => {
    try {
      const list = await api.listBusinesses();
      setProjects(list);
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "failed to load projects");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const launch = useCallback(async () => {
    const trimmed = idea.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { project_id } = await api.createBusiness({
        idea: trimmed,
        idempotency_key: idempKeyRef.current,
      });
      router.push(`/project/${encodeURIComponent(project_id)}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "failed to launch");
      idempKeyRef.current = newIdempotencyKey();
      setSubmitting(false);
    }
  }, [idea, submitting, router]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        launch();
      }
    },
    [launch],
  );

  const totals = useMemo(() => {
    if (!projects) return null;
    const active = projects.filter((p) => p.status !== "error").length;
    const total = projects.reduce((s, p) => s + p.stripe_balance_usd, 0);
    return { active, total };
  }, [projects]);

  return (
    <div className="max-w-6xl mx-auto px-8 pt-20 pb-16">
      {/* hero */}
      <div className="max-w-3xl">
        <div
          className="pill mb-6"
          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)", color: "#C4B5FD" }}
        >
          <div className="h-1.5 w-1.5 rounded-full accent-bg" />
          Powered by Terac · Real humans in the loop
        </div>
        <h1 className="serif text-6xl md:text-7xl leading-[0.95] tracking-tight mb-6">
          Turn any idea<br />into a <span className="italic" style={{ color: "#C4B5FD" }}>running business</span>.
        </h1>
        <p className="text-dim text-lg max-w-2xl leading-relaxed">
          Agents research the market, build the MVP, market it, and take payments —{" "}
          <span className="text-white">without asking you again</span>. When they hit a real judgment call,
          they ask real humans via Terac. Not other LLMs.
        </p>
      </div>

      {/* prompt input */}
      <div className="mt-12 max-w-3xl">
        <div className="card p-2 accent-ring">
          <div className="flex items-start gap-3 p-3">
            <div
              className="h-9 w-9 rounded-lg surface-2 flex items-center justify-center shrink-0 mt-1"
              style={{ border: "1px solid var(--border)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" aria-hidden>
                <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2 8 11.7 4 7.8 9.5 7z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="I have a 3D printer sitting idle for a month, make me money"
              className="flex-1 bg-transparent outline-none text-lg py-2 placeholder:text-faint"
              aria-label="Describe your idea"
              autoFocus
            />
            <button
              className="btn flex items-center gap-2 disabled:opacity-50"
              onClick={launch}
              disabled={submitting || !idea.trim()}
            >
              {submitting ? "Launching…" : "Launch"}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="border-t divider px-4 py-2.5 flex items-center justify-between text-xs text-faint mono">
            <span>Turn-based agents · SSE stream · refresh-safe</span>
            <span>{"⌘⏎"} to launch</span>
          </div>
        </div>
        {errorMsg && (
          <div className="mt-3 text-xs mono" style={{ color: "#FB7185" }}>
            {errorMsg}
          </div>
        )}

        {/* example chips */}
        <div className="flex flex-wrap gap-2 mt-5">
          <span className="text-xs text-faint mono self-center mr-2">try:</span>
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              className="example-chip"
              onClick={() => {
                setIdea(ex);
                inputRef.current?.focus();
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* project list */}
      <div className="mt-24">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-dim">Your projects</h2>
          <div className="flex-1 h-px divider border-t" />
          {totals && (
            <span className="text-xs text-faint mono tabnum">
              {totals.active} active · ${totals.total.toFixed(2)} total
            </span>
          )}
        </div>

        {listError && (
          <div className="text-xs mono mb-3" style={{ color: "#FB7185" }}>
            {listError}
          </div>
        )}

        {projects === null ? (
          <div className="text-xs text-faint mono">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="serif text-2xl mb-2">No projects yet.</div>
            <p className="text-dim text-sm">Type an idea above and hit Launch. Agents pick it up in seconds.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <Link
                key={p.project_id}
                href={`/project/${encodeURIComponent(p.project_id)}`}
                className="card card-hover block p-5 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: p.status === "live" ? "linear-gradient(135deg,#8B5CF6,#5B21B6)" : "var(--surface-2)", border: p.status === "live" ? undefined : "1px solid var(--border)" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={p.status === "live" ? "white" : "#C4B5FD"} strokeWidth="2" aria-hidden>
                      <rect x="4" y="4" width="16" height="12" rx="2" />
                      <path d="M8 20h8M12 16v4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold truncate">{p.goal}</span>
                      {statusPill(p.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-faint mono tabnum">
                      <span title={p.started_at}>started {relativeTime(p.started_at)}</span>
                      <span>·</span>
                      <span>{p.decisions_count} decisions</span>
                      {p.charges_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-400">
                            {p.charges_count} sale{p.charges_count === 1 ? "" : "s"}
                          </span>
                        </>
                      )}
                      {p.bugs_open > 0 && (
                        <>
                          <span>·</span>
                          <span style={{ color: "#FB7185" }}>{p.bugs_open} bug{p.bugs_open === 1 ? "" : "s"}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`serif text-3xl tabnum ${p.stripe_balance_usd === 0 ? "text-dim" : ""}`}>
                      ${Math.floor(p.stripe_balance_usd)}
                      <span className={p.stripe_balance_usd === 0 ? "text-faint" : "text-faint"}>
                        .{(p.stripe_balance_usd % 1).toFixed(2).slice(2)}
                      </span>
                    </div>
                    <div className="text-xs text-faint mono">
                      {p.stripe_balance_usd > 0 ? "stripe · rev" : "pending"}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-12 border-t divider pt-6 text-xs text-faint mono flex items-center gap-4">
          <span>tip:</span>
          <span>
            projects persist across refresh · every event is on disk · pivot any time by messaging the project
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto pt-16 pb-4 text-xs text-faint mono flex items-center justify-between border-t divider">
        <span>autobusiness.terac.dev</span>
        <span>Terac Zero Human Company Hackathon · Aug 15 2026</span>
      </div>
    </div>
  );
}
