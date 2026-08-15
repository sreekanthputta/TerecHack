"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, type MemoryFile } from "../../../../../lib/api";
import { parseFrontmatter, renderMarkdown } from "../../../../../lib/markdown";
import { relativeTime } from "../../../../../components/AgentLane";

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function pathParts(path: string): { folder: string; base: string } {
  const idx = path.lastIndexOf("/");
  if (idx === -1) return { folder: "", base: path };
  return { folder: path.slice(0, idx), base: path.slice(idx + 1) };
}

type Grouped = { folder: string; files: MemoryFile[] };

function groupByFolder(files: MemoryFile[]): Grouped[] {
  const map = new Map<string, MemoryFile[]>();
  for (const f of files) {
    const { folder } = pathParts(f.path);
    const arr = map.get(folder) ?? [];
    arr.push(f);
    map.set(folder, arr);
  }
  const list: Grouped[] = [];
  const root = map.get("");
  if (root && root.length > 0) list.push({ folder: "", files: root });
  const keys = Array.from(map.keys())
    .filter((k) => k !== "" && !k.startsWith("."))
    .sort();
  for (const k of keys) list.push({ folder: k, files: (map.get(k) ?? []).sort((a, b) => a.path.localeCompare(b.path)) });
  const archived = Array.from(map.keys()).filter((k) => k.startsWith("."));
  for (const k of archived.sort()) list.push({ folder: k, files: (map.get(k) ?? []).sort((a, b) => a.path.localeCompare(b.path)) });
  return list;
}

export default function MemoryPage() {
  const { id } = useParams<{ id: string }>();
  const [files, setFiles] = useState<MemoryFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { files: list } = await api.listMemory(id);
      setFiles(list);
      setError(null);
      if (list.length > 0) {
        setSelected((prev) => prev ?? list[0].path);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load memory");
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const grouped = useMemo(() => (files ? groupByFolder(files) : []), [files]);
  const active = useMemo(() => files?.find((f) => f.path === selected) ?? null, [files, selected]);

  const totals = useMemo(() => {
    if (!files) return null;
    const bytesTotal = files.reduce((s, f) => s + f.size, 0);
    const writers = new Set(files.map((f) => f.agent).filter(Boolean)).size;
    return { count: files.length, size: bytes(bytesTotal), writers };
  }, [files]);

  const parsed = useMemo(() => {
    if (!active?.content) return null;
    return parseFrontmatter(active.content);
  }, [active?.content]);

  const rendered = useMemo(() => {
    if (!parsed) return "";
    return renderMarkdown(parsed.body);
  }, [parsed]);

  return (
    <>
      <div className="border-b divider">
        <div className="max-w-[1400px] mx-auto px-8 h-14 flex items-center gap-4">
          <Link
            href={`/project/${encodeURIComponent(id)}`}
            className="flex items-center gap-2 text-dim hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="text-sm">Back to project</span>
          </Link>
          <div className="h-4 w-px surface-3" />
          <span className="text-sm font-medium">Agent Memory</span>
          <div className="text-xs mono text-faint tabnum ml-auto" title={id}>{id}</div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-8 pt-8 pb-16">
        <div className="mb-8">
          <div className="pill pill-agent mb-4">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="M4 4h6l2 2h8a2 2 0 012 2v9a3 3 0 01-3 3H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
            shared memory · read by every future agent
          </div>
          <h1 className="serif text-5xl mb-2">Everything the agents know.</h1>
          <p className="text-dim max-w-2xl">
            Persisted between turns. Read by every new agent that spawns. Survives crashes, restarts, pivots.
            This is why we don&apos;t lose context when killing an agent.
          </p>
        </div>

        {error && <div className="text-xs mono mb-3" style={{ color: "#FB7185" }}>{error}</div>}

        <div className="grid grid-cols-12 gap-6">
          {/* Tree */}
          <div className="col-span-12 md:col-span-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b divider">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 4h6l2 2h8a2 2 0 012 2v9a3 3 0 01-3 3H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
                </svg>
                <span className="mono text-xs text-dim">memory/</span>
                {totals && (
                  <span className="ml-auto text-xs mono text-faint tabnum">
                    {totals.count} file{totals.count === 1 ? "" : "s"} · {totals.size}
                  </span>
                )}
              </div>

              {files === null ? (
                <div className="text-xs text-faint mono">Loading…</div>
              ) : files.length === 0 ? (
                <div className="text-xs text-faint mono">No memory files yet.</div>
              ) : (
                <div className="space-y-0.5 text-sm">
                  {grouped.map((g) => (
                    <div key={g.folder || "_root"}>
                      {g.folder && (
                        <div className="px-4 py-1.5 mono text-xs text-dim flex items-center gap-1.5 mt-3">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                          {g.folder}/
                        </div>
                      )}
                      {g.files.map((f) => {
                        const { base } = pathParts(f.path);
                        const isActive = selected === f.path;
                        const isArchived = g.folder.startsWith(".");
                        return (
                          <button
                            type="button"
                            key={f.path}
                            onClick={() => setSelected(f.path)}
                            className={`file-item w-full text-left px-4 py-1.5 rounded mono text-xs flex items-center justify-between ${
                              isActive ? "active" : isArchived ? "text-faint" : "text-dim"
                            }`}
                          >
                            <span className="truncate">{base}</span>
                            {isArchived ? (
                              <span className="pill pill-archived text-[9px] py-0 px-1.5">archived</span>
                            ) : (
                              <span
                                className="text-[9px] text-faint mono tabnum ml-2 shrink-0"
                                title={f.updated_at}
                              >
                                {relativeTime(f.updated_at)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}

              {totals && (
                <div className="mt-5 pt-4 border-t divider grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-faint mono uppercase tracking-wider text-[10px] mb-0.5">last write</div>
                    <div className="text-dim tabnum">
                      {files && files.length > 0
                        ? relativeTime(
                            files.reduce(
                              (max, f) => (f.updated_at > max ? f.updated_at : max),
                              files[0].updated_at,
                            ),
                          )
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-faint mono uppercase tracking-wider text-[10px] mb-0.5">writers</div>
                    <div className="text-dim tabnum">{totals.writers} agent{totals.writers === 1 ? "" : "s"}</div>
                  </div>
                  <div>
                    <div className="text-faint mono uppercase tracking-wider text-[10px] mb-0.5">size</div>
                    <div className="text-dim tabnum">{totals.size}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Viewer */}
          <div className="col-span-12 md:col-span-8">
            <div className="card p-8">
              {active ? (
                <>
                  <div className="flex items-center gap-2 mb-6 text-xs mono flex-wrap">
                    {(() => {
                      const parts = active.path.split("/");
                      return parts.map((p, i) => (
                        <span key={i} className={`${i === parts.length - 1 ? "text-dim font-medium" : "text-faint"}`}>
                          {p}
                          {i < parts.length - 1 && (
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-faint inline-block ml-2"
                              aria-hidden
                            >
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                          )}
                        </span>
                      ));
                    })()}
                    <span className="pill pill-updated ml-auto text-[10px]" title={active.updated_at}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                        <path d="M12 6v6l4 2" />
                      </svg>
                      updated {relativeTime(active.updated_at)}
                    </span>
                    {active.agent && (
                      <span className="mono text-[11px] flex items-center gap-1">
                        <span style={{ color: "#C4B5FD" }}>{active.agent}</span>
                      </span>
                    )}
                  </div>

                  {parsed?.frontmatter && Object.keys(parsed.frontmatter).length > 0 && (
                    <div className="yaml-block">
                      <div className="c mb-2">---</div>
                      {Object.entries(parsed.frontmatter).map(([k, v]) => (
                        <div key={k}>
                          <span className="k">{k}:</span> <span className="v">{v}</span>
                        </div>
                      ))}
                      <div className="c mt-2">---</div>
                    </div>
                  )}

                  {active.content ? (
                    <div
                      className="md-content"
                      dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                  ) : (
                    <div className="text-sm text-faint mono">
                      Server did not return file content — {active.path} · {bytes(active.size)}
                    </div>
                  )}

                  <div className="mt-8 pt-6 border-t divider flex items-center gap-4 text-xs text-faint mono flex-wrap">
                    {active.agent && (
                      <div className="flex items-center gap-2">
                        <span>written by <span className="text-dim">{active.agent}</span></span>
                      </div>
                    )}
                    <span>·</span>
                    <span title={active.updated_at}>updated <span className="tabnum">{relativeTime(active.updated_at)}</span></span>
                    <span className="ml-auto tabnum">{bytes(active.size)}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-faint mono">Select a file to view.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
