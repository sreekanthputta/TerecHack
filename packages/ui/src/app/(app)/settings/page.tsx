"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PluginDescriptor, PluginConfig, PluginId } from "@autobiz/shared";
import { api } from "../../../lib/api";

const CATEGORY: Record<PluginId, string> = {
  terac: "Human panel",
  stripe: "Payments",
  anthropic: "AI model",
  render: "Deploy",
  linq: "Comms",
  superserve: "Sandbox browser",
  replay: "QA",
  shopify: "Commerce",
  cloudflare: "DNS · domains",
  twilio: "Comms",
  sendgrid: "Comms",
  ga4: "Analytics",
  etsy: "Research",
  meta_ads: "Ads",
  amazon: "Commerce",
};

const LOGO: Record<PluginId, { letter: string; gradient: string }> = {
  terac: { letter: "T", gradient: "linear-gradient(135deg,#8B5CF6,#5B21B6)" },
  stripe: { letter: "S", gradient: "linear-gradient(135deg,#635BFF,#4C46C4)" },
  anthropic: { letter: "A", gradient: "linear-gradient(135deg,#D97706,#92400E)" },
  render: { letter: "R", gradient: "linear-gradient(135deg,#46E3B7,#2AAE84)" },
  linq: { letter: "L", gradient: "linear-gradient(135deg,#0A84FF,#0053C7)" },
  superserve: { letter: "S", gradient: "linear-gradient(135deg,#FF6B6B,#C0392B)" },
  replay: { letter: "R", gradient: "linear-gradient(135deg,#22D3EE,#0891B2)" },
  shopify: { letter: "S", gradient: "linear-gradient(135deg,#95BF47,#5E8E3E)" },
  cloudflare: { letter: "C", gradient: "linear-gradient(135deg,#F6821F,#C25000)" },
  twilio: { letter: "T", gradient: "linear-gradient(135deg,#F22F46,#B71C36)" },
  sendgrid: { letter: "S", gradient: "linear-gradient(135deg,#1E88E5,#0D47A1)" },
  ga4: { letter: "G", gradient: "linear-gradient(135deg,#F9AB00,#E37400)" },
  etsy: { letter: "E", gradient: "linear-gradient(135deg,#F97316,#C2410C)" },
  meta_ads: { letter: "M", gradient: "linear-gradient(135deg,#1877F2,#0F5AB5)" },
  amazon: { letter: "A", gradient: "linear-gradient(135deg,#FF9900,#CC7A00)" },
};

function LogoTile({ id, size = 36 }: { id: PluginId; size?: number }) {
  const logo = LOGO[id];
  return (
    <div
      className="logo-tile shrink-0"
      style={{ background: logo.gradient, width: size, height: size, fontSize: size >= 44 ? 18 : 14 }}
    >
      {logo.letter}
    </div>
  );
}

function MaskedKey({ value }: { value: string }) {
  return (
    <span className="masked-key">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" aria-hidden>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
      <span>{value}</span>
    </span>
  );
}

type Filter = "all" | string;

function ConnectModal({
  descriptor,
  config,
  onClose,
  onSaved,
}: {
  descriptor: PluginDescriptor;
  config: PluginConfig | null;
  onClose: () => void;
  onSaved: (c: PluginConfig) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = descriptor.fields
    .filter((f) => f.required)
    .every((f) => (values[f.key] ?? "").trim().length > 0);

  async function save() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setErr(null);
    try {
      const saved = await api.putPluginConfig(descriptor.id, values);
      onSaved(saved);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (saving) return;
    setSaving(true);
    setErr(null);
    try {
      await api.deletePluginConfig(descriptor.id);
      onSaved({ id: descriptor.id, connected: false, masked_preview: {} });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to disconnect");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="flex items-start gap-4 p-6 pb-4">
          <LogoTile id={descriptor.id} size={44} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span id="modal-title" className="serif text-2xl">
                Connect {descriptor.name}
              </span>
              <span className="pill pill-cat">{CATEGORY[descriptor.id]}</span>
            </div>
            <p className="text-sm text-dim">{descriptor.purpose}</p>
          </div>
          <button className="text-faint hover:text-white -mt-1" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 pb-4 space-y-4">
          {descriptor.fields.map((f) => (
            <div key={f.key}>
              <label className="field-label">
                {f.label}
                {f.required ? (
                  <span className="pill pill-required" style={{ fontSize: 9, padding: "1px 5px" }}>
                    required
                  </span>
                ) : (
                  <span className="text-[10px] text-faint font-normal ml-1">optional</span>
                )}
              </label>
              <input
                type={f.secret ? "password" : "text"}
                className="settings-input"
                placeholder={f.placeholder}
                value={values[f.key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
              {f.secret && (
                <div className="field-hint">encrypted at rest · agents decrypt at runtime · never returned to browser</div>
              )}
            </div>
          ))}

          {descriptor.scopes && descriptor.scopes.length > 0 && (
            <div className="p-3 rounded-lg surface-2 border divider" style={{ borderColor: "var(--border)" }}>
              <div className="text-xs mono text-faint uppercase tracking-wider mb-2">Required scopes</div>
              <div className="flex flex-wrap gap-1.5">
                {descriptor.scopes.map((s) => (
                  <span
                    key={s}
                    className="mono text-[11px] px-2 py-0.5 rounded"
                    style={{
                      background: "rgba(16,185,129,0.10)",
                      color: "#6EE7B7",
                      border: "1px solid rgba(16,185,129,0.20)",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {descriptor.used_by.length > 0 && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-xs text-faint mono uppercase tracking-wider">used by</span>
              {descriptor.used_by.map((agent) => (
                <span key={agent} className="use-tag">
                  {agent}
                </span>
              ))}
            </div>
          )}

          {config?.connected && Object.keys(config.masked_preview).length > 0 && (
            <div className="pt-1">
              <div className="text-xs text-faint mono uppercase tracking-wider mb-2">Current values</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(config.masked_preview).map(([k, v]) => (
                  <MaskedKey key={k} value={`${k}: ${v}`} />
                ))}
              </div>
            </div>
          )}

          {err && (
            <div className="text-xs mono" style={{ color: "#FB7185" }}>
              {err}
            </div>
          )}
        </div>

        <div
          className="border-t divider px-6 py-4 flex items-center gap-3"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center gap-2 text-[11px] text-faint mono">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" aria-hidden>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>encrypted with AES-256 · never leaves the server</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {config?.connected && (
              <button
                type="button"
                className="btn-ghost"
                onClick={disconnect}
                disabled={saving}
                style={{ color: "#FB7185", borderColor: "rgba(244,63,94,0.24)" }}
              >
                Disconnect
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={save}
              disabled={!canSubmit || saving}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {saving ? "Saving…" : "Save & connect"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function IntegrationCard({
  descriptor,
  config,
  onOpen,
  compact = false,
}: {
  descriptor: PluginDescriptor;
  config: PluginConfig | null;
  onOpen: () => void;
  compact?: boolean;
}) {
  const connected = !!config?.connected;
  const preview = config?.masked_preview
    ? Object.values(config.masked_preview)[0]
    : null;

  const wrapperClass = [
    "integration",
    connected ? "connected" : "",
    !connected && descriptor.tier === "required" ? "required" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (compact) {
    return (
      <button type="button" className={wrapperClass + " text-left"} onClick={onOpen}>
        <div className="flex items-center gap-3">
          <LogoTile id={descriptor.id} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{descriptor.name}</div>
            <div className="text-[11px] text-faint mono truncate">
              {connected && preview ? preview : "not connected"}
            </div>
          </div>
          {connected ? (
            <span className="pill pill-connected">✓</span>
          ) : (
            <span className="btn-connect text-[11px]">Connect</span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="flex items-start gap-3">
        <LogoTile id={descriptor.id} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold">{descriptor.name}</span>
            <span className="pill pill-cat">{CATEGORY[descriptor.id]}</span>
            <span className={`pill ml-auto ${connected ? "pill-connected" : descriptor.tier === "required" ? "pill-required" : "pill-available"}`}>
              {connected && (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {connected ? "Connected" : descriptor.tier === "required" ? "Required" : "Available"}
            </span>
          </div>
          <div className="text-xs text-dim mb-3">{descriptor.purpose}</div>
          {connected && preview ? (
            <div className="flex items-center gap-2 flex-wrap">
              <MaskedKey value={preview} />
              <button
                type="button"
                className="text-[11px] mono text-faint hover:text-white"
                onClick={onOpen}
              >
                manage
              </button>
            </div>
          ) : (
            <button type="button" className="btn-connect w-full text-center" onClick={onOpen}>
              Connect
            </button>
          )}
        </div>
      </div>
      {descriptor.used_by.length > 0 && (
        <div className="flex items-center gap-2 pt-3 border-t divider flex-wrap">
          {descriptor.used_by.slice(0, 4).map((a) => (
            <span key={a} className="use-tag">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [descriptors, setDescriptors] = useState<PluginDescriptor[] | null>(null);
  const [configs, setConfigs] = useState<Map<PluginId, PluginConfig>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<PluginId | null>(null);

  const load = useCallback(async () => {
    try {
      const [descs, cfgs] = await Promise.all([api.listPlugins(), api.listPluginConfigs()]);
      setDescriptors(descs);
      setConfigs(new Map(cfgs.map((c) => [c.id, c])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!descriptors) return null;
    const q = query.trim().toLowerCase();
    return descriptors.filter((d) => {
      if (filter !== "all" && CATEGORY[d.id] !== filter) return false;
      if (q && !d.name.toLowerCase().includes(q) && !d.purpose.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [descriptors, filter, query]);

  const tiers = useMemo(() => {
    const req: PluginDescriptor[] = [];
    const rec: PluginDescriptor[] = [];
    const opt: PluginDescriptor[] = [];
    for (const d of filtered ?? []) {
      if (d.tier === "required") req.push(d);
      else if (d.tier === "recommended") rec.push(d);
      else opt.push(d);
    }
    return { req, rec, opt };
  }, [filtered]);

  const counts = useMemo(() => {
    if (!descriptors) return { connected: 0, available: 0, total: 0 };
    const total = descriptors.length;
    let connected = 0;
    for (const d of descriptors) if (configs.get(d.id)?.connected) connected++;
    return { connected, available: total - connected, total };
  }, [descriptors, configs]);

  const categories = useMemo(() => {
    if (!descriptors) return [];
    const set = new Set<string>();
    for (const d of descriptors) set.add(CATEGORY[d.id]);
    return Array.from(set).sort();
  }, [descriptors]);

  const openDescriptor = descriptors?.find((d) => d.id === openId) ?? null;

  function onSaved(c: PluginConfig) {
    setConfigs((prev) => {
      const next = new Map(prev);
      if (c.connected) next.set(c.id, c);
      else next.delete(c.id);
      return next;
    });
  }

  return (
    <>
      <div className="max-w-[1400px] mx-auto px-8 pt-10 pb-16">
        <div className="mb-10">
          <h1 className="serif text-5xl mb-2">Settings</h1>
          <p className="text-dim max-w-2xl">
            Connect the tools your agents will use. Each plugin gets an API key stored encrypted at rest and never
            returned to the browser — only agents can decrypt.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-3">
            <div className="text-xs mono text-faint uppercase tracking-wider mb-3 px-2">Workspace</div>
            <div className="space-y-1 mb-6">
              <button type="button" className="nav-item active">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M20 7h-9M14 17H5M17 4l3 3-3 3M7 20l-3-3 3-3" />
                </svg>
                Integrations
                <span className="ml-auto mono text-[10px] text-faint tabnum">
                  {counts.connected} / {counts.total}
                </span>
              </button>
              <button type="button" className="nav-item" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
                Billing &amp; plan
              </button>
              <button type="button" className="nav-item" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                Notifications
              </button>
              <button type="button" className="nav-item" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777z" />
                </svg>
                API keys (mine)
              </button>
              <button type="button" className="nav-item" disabled>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Team
              </button>
            </div>

            <div
              className="mt-8 p-4 rounded-lg"
              style={{ background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.20)" }}
            >
              <div
                className="flex items-center gap-2 mb-2 text-xs mono uppercase tracking-wider"
                style={{ color: "#6EE7B7" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                how keys are stored
              </div>
              <p className="text-xs text-dim leading-relaxed">
                Keys are AES-256 encrypted server-side. Never returned to browser after save. Rotated with one click.
                Revoked on workspace delete.
              </p>
            </div>
          </div>

          <div className="col-span-12 md:col-span-9">
            <div className="flex items-end gap-4 mb-6 flex-wrap">
              <div>
                <h2 className="serif text-3xl mb-1">Integrations</h2>
                <p className="text-sm text-dim">
                  Enable a plugin, drop in the credentials once, and agents pick it up on the next turn.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3 text-xs mono text-faint tabnum">
                <span>
                  <span style={{ color: "#34D399" }}>{counts.connected}</span> connected
                </span>
                <span>·</span>
                <span>
                  <span className="text-white">{counts.available}</span> available
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <div className="relative flex-1 max-w-xs">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search integrations..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="settings-input pl-9"
                  style={{ fontFamily: "Inter, system-ui, sans-serif" }}
                />
              </div>
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`pill ${filter === "all" ? "pill-scale" : "pill-available"}`}
                style={{ cursor: "pointer" }}
              >
                All · <span className="tabnum">{descriptors?.length ?? 0}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  className={`pill ${filter === c ? "pill-scale" : "pill-available"}`}
                  style={{ cursor: "pointer" }}
                >
                  {c}
                </button>
              ))}
            </div>

            {error && (
              <div className="text-xs mono mb-4" style={{ color: "#FB7185" }}>
                {error}
              </div>
            )}

            {descriptors === null ? (
              <div className="text-xs text-faint mono">Loading…</div>
            ) : (
              <>
                {tiers.req.length > 0 && (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="text-xs mono text-faint uppercase tracking-wider">
                        Required · without these, agents can&apos;t ship
                      </div>
                      <div className="flex-1 h-px divider border-t" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
                      {tiers.req.map((d) => (
                        <IntegrationCard
                          key={d.id}
                          descriptor={d}
                          config={configs.get(d.id) ?? null}
                          onOpen={() => setOpenId(d.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {tiers.rec.length > 0 && (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="text-xs mono text-faint uppercase tracking-wider">
                        Recommended · enable to unlock more agent capability
                      </div>
                      <div className="flex-1 h-px divider border-t" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
                      {tiers.rec.map((d) => (
                        <IntegrationCard
                          key={d.id}
                          descriptor={d}
                          config={configs.get(d.id) ?? null}
                          onOpen={() => setOpenId(d.id)}
                        />
                      ))}
                    </div>
                  </>
                )}

                {tiers.opt.length > 0 && (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="text-xs mono text-faint uppercase tracking-wider">
                        More · optional plugins for growth &amp; analytics
                      </div>
                      <div className="flex-1 h-px divider border-t" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {tiers.opt.map((d) => (
                        <IntegrationCard
                          key={d.id}
                          descriptor={d}
                          config={configs.get(d.id) ?? null}
                          onOpen={() => setOpenId(d.id)}
                          compact
                        />
                      ))}
                    </div>
                  </>
                )}

                {tiers.req.length === 0 && tiers.rec.length === 0 && tiers.opt.length === 0 && (
                  <div className="text-xs text-faint mono">No integrations match this filter.</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {openDescriptor && (
        <ConnectModal
          descriptor={openDescriptor}
          config={configs.get(openDescriptor.id) ?? null}
          onClose={() => setOpenId(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}
