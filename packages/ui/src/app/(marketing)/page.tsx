import Link from "next/link";

export const metadata = {
  title: "AutoBusiness — Turn any idea into a running business",
  description:
    "Type an idea. Agents research the market, ship the MVP, take payments, and monitor the live site — while a panel of real humans validates every judgment call.",
};

const ArrowRight = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    aria-hidden
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

const Check = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#34D399"
    strokeWidth="2.5"
    className="mt-0.5 shrink-0"
    aria-hidden
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const Cross = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#6B6B72"
    strokeWidth="2"
    className="mt-0.5 shrink-0"
    aria-hidden
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function LandingPage() {
  return (
    <>
      {/* NAV */}
      <div
        className="border-b divider sticky top-0 z-30 backdrop-blur-xl"
        style={{ background: "rgba(10,10,10,0.7)" }}
      >
        <div className="max-w-6xl mx-auto px-8 h-16 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#5B21B6)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden>
                <path d="M12 3v18M3 12h18" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight text-[15px]">AutoBusiness</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-dim ml-4">
            <a href="#how" className="hover:text-white transition-colors">How it works</a>
            <a href="#agents" className="hover:text-white transition-colors">Agents</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-dim hover:text-white transition-colors cursor-pointer">Sign in</span>
            <Link href="/home" className="btn-primary flex items-center gap-2">
              Start Building
              <ArrowRight />
            </Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div className="relative overflow-hidden noise">
        <div className="absolute inset-0 grid-pattern fade-mask-b opacity-40 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-8 pt-24 pb-20 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="pill pill-accent mb-6 mx-auto">
              <div className="h-1.5 w-1.5 rounded-full accent-bg" />
              Powered by Terac · real humans in the loop, not other LLMs
            </div>
            <h1 className="serif text-[68px] md:text-[92px] leading-[0.92] tracking-tight mb-6">
              Turn any idea<br />into a <span className="italic" style={{ color: "#C4B5FD" }}>running business.</span>
            </h1>
            <p className="text-dim text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
              Type an idea. Agents research the market, ship the MVP, take payments, and monitor the live site — while a panel of real humans validates every judgment call.
            </p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Link href="/home" className="btn-primary flex items-center gap-2 text-[15px]">
                Start Building — it&apos;s free
                <ArrowRight size={14} />
              </Link>
              <a href="#agents" className="btn-ghost flex items-center gap-2 text-[15px]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <polygon points="5,3 19,12 5,21" />
                </svg>
                Watch a live project
              </a>
            </div>
            <div className="text-xs text-faint mono tabnum flex items-center justify-center gap-4">
              <span>no credit card</span>
              <span>·</span>
              <span>ship in under 10 minutes</span>
              <span>·</span>
              <span>Stripe + Terac included</span>
            </div>
          </div>

          {/* DEMO WINDOW */}
          <div className="max-w-4xl mx-auto mt-16 demo-window">
            <div className="window-chrome">
              <div className="traffic" style={{ background: "#FB7185" }} />
              <div className="traffic" style={{ background: "#FBBF24" }} />
              <div className="traffic" style={{ background: "#34D399" }} />
              <div className="ml-3 text-xs mono text-faint tabnum">autobusiness.terac.dev/proj_k3n2p9xa</div>
              <div className="ml-auto flex items-center gap-2 text-xs mono text-faint">
                <div className="dot-live" />
                <span>LIVE · 8m elapsed</span>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="col-span-2 border-r divider">
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(56,189,248,0.10)", color: "#7DD3FC", border: "1px solid rgba(56,189,248,0.25)", fontSize: 10 }}>Planner</span>
                  <span className="text-dim">Drafting 4-step plan: research → validate → build → verify</span>
                  <span className="ml-auto text-faint tabnum">8m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(139,92,246,0.10)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.25)", fontSize: 10 }}>Researcher</span>
                  <span className="text-dim">Cable organizers looks best · <span style={{ color: "#FB7185" }}>conf 0.50</span></span>
                  <span className="ml-auto text-faint tabnum">5m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3" style={{ background: "rgba(139,92,246,0.04)" }}>
                  <span className="pill" style={{ background: "rgba(240,171,252,0.10)", color: "#F5D0FE", border: "1px solid rgba(240,171,252,0.25)", fontSize: 10 }}>Verifier</span>
                  <span className="text-dim">Consulting 15 real makers via Terac...</span>
                  <span className="ml-auto text-faint tabnum">4m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(16,185,129,0.10)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.25)", fontSize: 10 }}>terac_result</span>
                  <span className="text-dim">12 of 15 makers confirm · <span style={{ color: "#34D399" }}>conf 0.85</span></span>
                  <span className="ml-auto text-faint tabnum">3m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(245,158,11,0.10)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.25)", fontSize: 10 }}>Builder</span>
                  <span className="text-dim">Deployed <span style={{ color: "#C4B5FD" }}>cablecraft-k3n2.onrender.com</span></span>
                  <span className="ml-auto text-faint tabnum">2m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(34,211,238,0.10)", color: "#67E8F9", border: "1px solid rgba(34,211,238,0.25)", fontSize: 10 }}>Replay QA</span>
                  <span className="text-dim">17 checks · all pass · <span style={{ color: "#34D399" }}>shipped clean</span></span>
                  <span className="ml-auto text-faint tabnum">2m ago</span>
                </div>
                <div className="demo-row flex items-center gap-3">
                  <span className="pill" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399", border: "1px solid rgba(16,185,129,0.25)", fontSize: 10 }}>Sale</span>
                  <span className="text-dim">+$12.00 · charge ch_3O4x…zK</span>
                  <span className="ml-auto text-faint tabnum">30s ago</span>
                </div>
              </div>
              <div className="p-5 flex flex-col justify-between">
                <div>
                  <div className="text-xs text-faint mono uppercase tracking-wider mb-2">Stripe balance</div>
                  <div className="serif text-5xl tabnum">$24<span className="text-faint text-2xl">.00</span></div>
                  <div className="text-xs mono mt-1" style={{ color: "#34D399" }}>+$12 · 30s ago</div>
                </div>
                <div className="text-xs text-faint mono mt-6 space-y-1">
                  <div>7 agents · 4 lanes</div>
                  <div>18 memory files</div>
                  <div>35 humans consulted</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="border-y divider py-4 overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="ticker-track text-sm text-dim mono">
          {[0, 1].map((i) => (
            <span key={`t-${i}`} className="flex items-center gap-8 shrink-0">
              <span className="flex items-center gap-2"><span>ceramic mugs → hand-poured candles</span> · <span className="text-faint">pivoted at turn 4</span></span>
              <span className="flex items-center gap-2"><span>CableCraft</span> · <span style={{ color: "#34D399" }}>$24.00</span> · <span className="text-faint">8m to first sale</span></span>
              <span className="flex items-center gap-2"><span>Tandoori Palace delivery</span> · <span style={{ color: "#34D399" }}>$12.00</span> · <span className="text-faint">6 agents</span></span>
              <span className="flex items-center gap-2"><span>WaxWork candles</span> · <span className="text-faint">Replay caught checkout bug · patched in 90s</span></span>
              <span className="flex items-center gap-2"><span>resume-roast.co</span> · <span style={{ color: "#34D399" }}>$47.00</span> · <span className="text-faint">Service Watcher: 99.9% uptime</span></span>
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" className="max-w-6xl mx-auto px-8 py-32">
        <div className="max-w-2xl mb-16">
          <div className="pill pill-accent mb-4">how it works</div>
          <h2 className="serif text-5xl md:text-6xl leading-tight mb-4">Three steps.<br />Nothing to configure.</h2>
          <p className="text-dim text-lg">You type. Agents ship. Humans validate. It&apos;s the same loop a real startup runs — just autonomous and 100× faster.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card p-7">
            <div className="agent-icon" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" aria-hidden>
                <path d="M12 20l9-16H3z" transform="rotate(180 12 12)" />
              </svg>
            </div>
            <div className="text-xs mono text-faint mb-2 tabnum">01</div>
            <div className="serif text-2xl mb-2">You describe the idea</div>
            <p className="text-dim text-sm leading-relaxed">One sentence. &ldquo;Sell hand-poured candles.&rdquo; &ldquo;Monetize this idle 3D printer.&rdquo; &ldquo;Delivery site for the restaurant on the corner.&rdquo; That&apos;s the whole config.</p>
          </div>
          <div className="card p-7">
            <div className="agent-icon" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7DD3FC" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="text-xs mono text-faint mb-2 tabnum">02</div>
            <div className="serif text-2xl mb-2">Agents research &amp; ship</div>
            <p className="text-dim text-sm leading-relaxed">Planner scopes the work. Researcher scrapes the market. Verifier consults humans via Terac when unsure. Builder ships the site + Stripe. Replay QA verifies. Watchers monitor.</p>
          </div>
          <div className="card p-7">
            <div className="agent-icon" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" strokeWidth="2" aria-hidden>
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
            <div className="text-xs mono text-faint mb-2 tabnum">03</div>
            <div className="serif text-2xl mb-2">Money hits your Stripe</div>
            <p className="text-dim text-sm leading-relaxed">Real charges. Real balance. Watchers keep the site up, fix bugs on the fly, and ping you on iMessage when something needs a human. You keep the money.</p>
          </div>
        </div>
      </div>

      {/* AGENTS */}
      <div id="agents" className="max-w-6xl mx-auto px-8 pb-32">
        <div className="max-w-2xl mb-14">
          <div className="pill pill-accent mb-4">the agents</div>
          <h2 className="serif text-5xl md:text-6xl leading-tight mb-4">A whole company,<br />in seven roles.</h2>
          <p className="text-dim text-lg">Each agent owns one job, reads shared memory, and hands off cleanly. Kill any one of them and the rest recover — memory is on disk, not in a fragile chain-of-thought.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7DD3FC" strokeWidth="2" aria-hidden>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Planner</div>
            <div className="text-xs mono text-faint mb-3">turn 0 · replans on pivot</div>
            <p className="text-dim text-sm leading-relaxed">Breaks your idea into a step-by-step business plan. Redrafts on every pivot without losing prior context.</p>
          </div>
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4B5FD" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Researcher</div>
            <div className="text-xs mono text-faint mb-3">Superserve sandbox · Etsy/Reddit/etc.</div>
            <p className="text-dim text-sm leading-relaxed">Scrapes the market in a fresh browser. Ranks niches, price bands, and demand signal — with a confidence score.</p>
          </div>
          <div
            className="agent-card"
            style={{ background: "linear-gradient(180deg,rgba(240,171,252,0.05),var(--surface))", borderColor: "rgba(240,171,252,0.25)" }}
          >
            <div className="agent-icon" style={{ background: "rgba(240,171,252,0.15)", border: "1px solid rgba(240,171,252,0.35)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5D0FE" strokeWidth="2" aria-hidden>
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
              </svg>
            </div>
            <div className="font-semibold mb-1 flex items-center gap-2">
              Verifier
              <span className="pill" style={{ background: "rgba(240,171,252,0.10)", color: "#F5D0FE", border: "1px solid rgba(240,171,252,0.30)", fontSize: 10 }}>Terac</span>
            </div>
            <div className="text-xs mono text-faint mb-3">star agent · human panel</div>
            <p className="text-dim text-sm leading-relaxed">When any agent&apos;s confidence drops below 0.6, the Verifier consults <span className="text-white">real humans</span> via Terac. Not a second LLM.</p>
          </div>
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" aria-hidden>
                <path d="M3 6l9-4 9 4v6c0 5-3.5 9-9 10-5.5-1-9-5-9-10V6z" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Builder</div>
            <div className="text-xs mono text-faint mb-3">ships landing + Stripe</div>
            <p className="text-dim text-sm leading-relaxed">Generates the site, copy, and product SKUs. Wires Stripe, deploys to Render, returns a live URL. Retries on Replay bug reports.</p>
          </div>
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#67E8F9" strokeWidth="2" aria-hidden>
                <path d="M4 12a8 8 0 018-8v0a8 8 0 018 8v0a8 8 0 01-8 8v0a8 8 0 01-8-8z" />
                <path d="M9 9l6 3-6 3z" fill="#67E8F9" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Replay QA</div>
            <div className="text-xs mono text-faint mb-3">headless browser · 17 checks</div>
            <p className="text-dim text-sm leading-relaxed">Runs the site as a real user would. Adds to cart, checks out, fills forms. Files a bug report — Builder respawns with the diff and re-ships.</p>
          </div>
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.28)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" strokeWidth="2" aria-hidden>
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Revenue Watcher</div>
            <div className="text-xs mono text-faint mb-3">cron · Stripe · 30s tick</div>
            <p className="text-dim text-sm leading-relaxed">Polls Stripe for new charges. On every sale, pings the owner and updates the balance on the live dashboard.</p>
          </div>
          <div className="agent-card">
            <div className="agent-icon" style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" aria-hidden>
                <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div className="font-semibold mb-1">Service Watcher</div>
            <div className="text-xs mono text-faint mb-3">cron · uptime + logs · 60s tick</div>
            <p className="text-dim text-sm leading-relaxed">Watches uptime, latency, and error logs on the deployed site. On anomaly, files a bug and hands it to Builder.</p>
          </div>
          <div className="agent-card" style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.02),var(--surface))", borderStyle: "dashed" }}>
            <div className="agent-icon" style={{ background: "var(--surface-2)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A9AA1" strokeWidth="2" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className="font-semibold mb-1 text-dim">Custom agent</div>
            <div className="text-xs mono text-faint mb-3">Scale tier</div>
            <p className="text-faint text-sm leading-relaxed">On the Scale plan, drop in your own agent (marketing, support, ops) with a single YAML manifest.</p>
          </div>
        </div>
      </div>

      {/* BUG-FIX LOOP FEATURE STRIP */}
      <div className="border-t divider" style={{ background: "linear-gradient(180deg,rgba(34,211,238,0.03),transparent 60%)" }}>
        <div className="max-w-6xl mx-auto px-8 py-24 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="pill pill-accent mb-4">the bug-fix loop</div>
            <h2 className="serif text-4xl md:text-5xl leading-tight mb-4">Ships broken?<br />Fixes itself.</h2>
            <p className="text-dim text-lg mb-6">Every Builder deploy triggers Replay QA — a headless browser that walks the site as a real user. If checkout is broken, forms don&apos;t validate, or the price is missing, Replay files a structured bug report. A new Builder respawns with the diff in hand and re-ships. Loop until green.</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4">
                <div className="text-xs text-faint mono uppercase tracking-wider mb-1">Median cycle</div>
                <div className="serif text-3xl tabnum">92<span className="text-faint text-lg">s</span></div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-faint mono uppercase tracking-wider mb-1">Auto-fixed</div>
                <div className="serif text-3xl tabnum">84<span className="text-faint text-lg">%</span></div>
              </div>
              <div className="card p-4">
                <div className="text-xs text-faint mono uppercase tracking-wider mb-1">Owner pings</div>
                <div className="serif text-3xl tabnum">16<span className="text-faint text-lg">%</span></div>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <div className="text-xs text-faint mono uppercase tracking-wider mb-4">Replay QA · run #3</div>
            <div className="space-y-2 mono text-xs">
              <div className="flex items-center gap-2"><span className="check">✓</span><span className="text-dim">landing loads · 240ms</span></div>
              <div className="flex items-center gap-2"><span className="check">✓</span><span className="text-dim">hero copy visible</span></div>
              <div className="flex items-center gap-2"><span className="check">✓</span><span className="text-dim">product images load · 3/3</span></div>
              <div className="flex items-center gap-2"><span style={{ color: "#FB7185" }}>✗</span><span style={{ color: "#FB7185" }}>&ldquo;add to cart&rdquo; 404s on SKU-2</span></div>
              <div className="flex items-center gap-2"><span style={{ color: "#FB7185" }}>✗</span><span style={{ color: "#FB7185" }}>checkout form: price missing on mobile viewport</span></div>
              <div className="flex items-center gap-2"><span className="check">✓</span><span className="text-dim">stripe webhook · 200 OK</span></div>
              <div className="pt-3 mt-3 border-t divider flex items-center gap-2 text-dim">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" aria-hidden>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span>spawning Builder(v2) with 2 bugs...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div id="pricing" className="max-w-6xl mx-auto px-8 py-32">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="pill pill-accent mb-4 mx-auto">pricing</div>
          <h2 className="serif text-5xl md:text-6xl leading-tight mb-4">Pay for the humans,<br />not the tokens.</h2>
          <p className="text-dim text-lg">Every Terac response is a real person&apos;s time. That&apos;s where your money goes — not into another wrapper&apos;s margin. Cancel any time. No usage fees.</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-10 text-sm">
          <span className="text-white">Monthly</span>
          <div
            className="relative inline-flex items-center h-6 w-11 rounded-full"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
          >
            <div className="h-4 w-4 rounded-full absolute left-1 accent-bg" />
          </div>
          <span className="text-dim">Yearly <span className="text-emerald-400 text-xs ml-1">save 20%</span></span>
        </div>

        <div className="grid md:grid-cols-3 gap-5 items-stretch">
          <div className="price-card flex flex-col">
            <div className="text-sm font-semibold text-dim mb-1">Hobbyist</div>
            <div className="text-xs text-faint mb-5">Try it. Ship something real for free.</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="serif text-6xl tabnum">$0</span>
              <span className="text-faint text-sm">/ month</span>
            </div>
            <div className="text-xs text-faint mono mb-6">forever · no card</div>
            <Link href="/home" className="btn-ghost text-center mb-8">Start free</Link>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">1</span> concurrent project</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">100</span> Terac responses / month</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">All 7 core agents</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Stripe test-mode</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Community Discord</span></li>
              <li className="flex items-start gap-2"><Cross /><span className="cross">Custom domain</span></li>
              <li className="flex items-start gap-2"><Cross /><span className="cross">Priority Terac queue</span></li>
            </ul>
          </div>

          <div className="price-card featured flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="pill" style={{ background: "var(--violet)", color: "white", fontWeight: 600, boxShadow: "0 8px 20px rgba(139,92,246,0.35)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 14.8 7.1 17.2 8 11.7 4 7.8 9.5 7z" />
                </svg>
                Most popular
              </span>
            </div>
            <div className="text-sm font-semibold mb-1" style={{ color: "#DDD6FE" }}>Founder</div>
            <div className="text-xs text-faint mb-5">For the person who actually ships.</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="serif text-6xl tabnum">$49</span>
              <span className="text-faint text-sm">/ month</span>
            </div>
            <div className="text-xs text-faint mono mb-6">billed monthly · cancel any time</div>
            <Link href="/home" className="btn-primary text-center mb-8">Start 14-day trial</Link>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">3</span> concurrent projects</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">2,000</span> Terac responses / month</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Real Stripe · your account</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Custom domain per project</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">iMessage owner alerts</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Priority Terac queue</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Email support · 24h response</span></li>
            </ul>
          </div>

          <div className="price-card flex flex-col">
            <div className="text-sm font-semibold text-dim mb-1">Scale</div>
            <div className="text-xs text-faint mb-5">For agencies, studios, and portfolio builders.</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="serif text-6xl tabnum">$199</span>
              <span className="text-faint text-sm">/ month</span>
            </div>
            <div className="text-xs text-faint mono mb-6">billed monthly · usage caps waived</div>
            <a href="#faq" className="btn-ghost text-center mb-8">Talk to us</a>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">Unlimited</span> projects</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim"><span className="text-white">10,000</span> Terac responses / month</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Everything in Founder</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Custom agents (YAML manifest)</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Bring your own LLM keys</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">SLA · 99.9% uptime</span></li>
              <li className="flex items-start gap-2"><Check /><span className="text-dim">Dedicated Slack channel</span></li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-10 text-xs text-faint mono">
          All plans include: agent memory as MD files · SSE trace stream · refresh-safe · pivot any time · Replay QA · Revenue + Service Watchers
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="max-w-3xl mx-auto px-8 pb-32">
        <div className="text-center mb-12">
          <div className="pill pill-accent mb-4 mx-auto">faq</div>
          <h2 className="serif text-5xl md:text-6xl leading-tight">Reasonable questions.</h2>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">Is the money real?</div>
          <p className="text-dim text-sm leading-relaxed">Yes. Stripe charges land in <span className="text-white">your</span> Stripe account. AutoBusiness never touches the funds. On Hobbyist you&apos;re in Stripe test-mode; on Founder+ you connect your real account.</p>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">Who are the humans on Terac?</div>
          <p className="text-dim text-sm leading-relaxed">Real, verified respondents — makers, buyers, professionals — surfaced by Terac&apos;s panel. Not other LLMs. Median response time under a minute. Your Verifier agent picks the right panel per question (e.g. &ldquo;3D printer owners&rdquo; vs &ldquo;general shoppers&rdquo;).</p>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">What if it ships something broken?</div>
          <p className="text-dim text-sm leading-relaxed">Replay QA runs the site as a real user right after each deploy. If checkout is broken or a form doesn&apos;t validate, it files a bug report and Builder respawns with the diff. 84% of bugs are fixed without you noticing. The other 16% ping you on iMessage.</p>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">Can I pivot mid-flight?</div>
          <p className="text-dim text-sm leading-relaxed">Yes — just message the project. &ldquo;Actually switch from mugs to candles.&rdquo; The message queues, agents finish their current turn cleanly, then the Planner absorbs the pivot and re-plans. Memory carries over — nothing is lost.</p>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">What happens when an agent crashes?</div>
          <p className="text-dim text-sm leading-relaxed">Agents write their work to a per-project memory folder as MD files. A crash respawn reads the memory index and picks up on the next turn boundary. This is why we can kill and re-spawn Builder for bug-fix cycles without losing context.</p>
        </div>

        <div className="faq-item">
          <div className="font-semibold mb-2">Do I own what gets built?</div>
          <p className="text-dim text-sm leading-relaxed">Fully. Site code, Stripe account, domain, memory files — all yours. Export the whole project as a zip at any time. AutoBusiness is the orchestration layer, not the owner.</p>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="border-t divider" style={{ background: "radial-gradient(ellipse 600px 200px at 50% 100%, rgba(139,92,246,0.14), transparent 60%)" }}>
        <div className="max-w-3xl mx-auto px-8 py-24 text-center">
          <h2 className="serif text-5xl md:text-6xl leading-tight mb-4">Ship your idea today.</h2>
          <p className="text-dim text-lg mb-8">You&apos;ll have a running business — with real humans validating it — before the next meeting on your calendar.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/home" className="btn-primary flex items-center gap-2 text-[15px]">
              Start Building
              <ArrowRight size={14} />
            </Link>
            <a href="#agents" className="btn-ghost">See a live one</a>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t divider">
        <div className="max-w-6xl mx-auto px-8 py-10 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#8B5CF6,#5B21B6)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" aria-hidden>
                <path d="M12 3v18M3 12h18" />
              </svg>
            </div>
            <span className="font-semibold tracking-tight text-sm">AutoBusiness</span>
            <span className="text-faint text-xs mono ml-2">autobusiness.terac.dev</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-faint mono md:ml-auto">
            <span className="hover:text-white transition-colors cursor-pointer">Privacy</span>
            <span className="hover:text-white transition-colors cursor-pointer">Terms</span>
            <span className="hover:text-white transition-colors cursor-pointer">Docs</span>
            <span className="hover:text-white transition-colors cursor-pointer">Changelog</span>
            <span>·</span>
            <span>Terac Zero Human Company Hackathon · Aug 15 2026</span>
          </div>
        </div>
      </div>
    </>
  );
}
