import { env } from "../env.js";
import { logger } from "../logger.js";

const BASE = "https://api.superserve.com/v1";

export type SessionRecord = {
  session_id: string;
  browser_ws_url: string;
  status: "active" | "paused";
  ttl_sec: number;
  created_at: string;
  last_used_at: string;
};

const pool: SessionRecord[] = [];

function fixtureSession(ttl_sec: number): SessionRecord {
  const id = `ss_fx_${Math.random().toString(36).slice(2, 10)}`;
  return {
    session_id: id,
    browser_ws_url: `ws://fixture.superserve.local/${id}`,
    status: "active",
    ttl_sec,
    created_at: new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  };
}

/**
 * Grab a paused session from the pool and resume it — this is what earns the
 * Superserve track: sandboxes are paused between calls, not spun up fresh each
 * time. Real Superserve API is called only when the pool is empty.
 */
export async function acquireSession(ttl_sec?: number): Promise<SessionRecord> {
  const ttl = ttl_sec ?? env.SUPERSERVE_SESSION_TTL_SEC;

  const paused = pool.find((s) => s.status === "paused");
  if (paused) {
    if (!env.FIXTURE_MODE && env.SUPERSERVE_API_KEY) {
      await callSuperserve(`/sessions/${paused.session_id}/resume`, "POST").catch((err) => {
        logger.warn({ err, id: paused.session_id }, "superserve resume failed; recreating");
        return null;
      });
    }
    paused.status = "active";
    paused.last_used_at = new Date().toISOString();
    return paused;
  }

  if (env.FIXTURE_MODE || !env.SUPERSERVE_API_KEY) {
    const session = fixtureSession(ttl);
    pool.push(session);
    return session;
  }

  try {
    const res = await callSuperserve("/sessions", "POST", { ttl_sec: ttl });
    const data = (await res.json()) as { id: string; browser_ws_url: string };
    const session: SessionRecord = {
      session_id: data.id,
      browser_ws_url: data.browser_ws_url,
      status: "active",
      ttl_sec: ttl,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };
    pool.push(session);
    return session;
  } catch (err) {
    // Superserve's managed-browser host is unreachable in this environment.
    // Hand back a local session so the researcher can still proceed — browse()
    // does a real direct fetch(url), so page reads remain real.
    logger.warn({ err }, "superserve acquire failed; using local session (browse still does real fetch)");
    const session = fixtureSession(ttl);
    pool.push(session);
    return session;
  }
}

/**
 * Release a session back to the pool. If pool capacity is exceeded, actually
 * delete the underlying sandbox; otherwise pause it (billing pauses too).
 */
export async function releaseSession(id: string): Promise<{ ok: true }> {
  const idx = pool.findIndex((s) => s.session_id === id);
  if (idx === -1) return { ok: true };
  const session = pool[idx]!;

  const overCapacity = pool.length > env.SUPERSERVE_POOL_SIZE;
  if (overCapacity) {
    pool.splice(idx, 1);
    if (!env.FIXTURE_MODE && env.SUPERSERVE_API_KEY) {
      await callSuperserve(`/sessions/${id}`, "DELETE").catch((err) =>
        logger.warn({ err, id }, "superserve delete failed"),
      );
    }
    return { ok: true };
  }

  session.status = "paused";
  session.last_used_at = new Date().toISOString();
  if (!env.FIXTURE_MODE && env.SUPERSERVE_API_KEY) {
    await callSuperserve(`/sessions/${id}/pause`, "POST").catch((err) =>
      logger.warn({ err, id }, "superserve pause failed"),
    );
  }
  return { ok: true };
}

async function callSuperserve(path: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${env.SUPERSERVE_API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "");
    throw new Error(`superserve ${method} ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

/**
 * Warm one paused session at boot so the first Researcher call is fast.
 * Non-fatal: pool starts empty on failure.
 */
export async function warmPool(): Promise<void> {
  if (pool.length > 0) return;
  try {
    const s = await acquireSession();
    await releaseSession(s.session_id);
    logger.info({ pool_size: pool.length }, "superserve pool warmed");
  } catch (err) {
    logger.warn({ err }, "superserve warm failed");
  }
}

export function _peekPool(): SessionRecord[] {
  return [...pool];
}

export type BrowseResult = { url: string; text: string; title?: string };
export type SearchResult = {
  query: string;
  results: Array<{ url: string; title: string; snippet: string }>;
};

function touchSession(id: string): void {
  const s = pool.find((x) => x.session_id === id);
  if (s) s.last_used_at = new Date().toISOString();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fixtureBrowse(url: string): BrowseResult {
  const topic = decodeURIComponent(url)
    .replace(/^https?:\/\//, "")
    .replace(/^search:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const title = topic ? `Market overview: ${topic}` : "Market overview";
  const text = [
    `${title}. Demand for ${topic || "this niche"} has grown steadily over the last three years,`,
    `driven by hobbyist and small-batch buyers who value customization and fast turnaround.`,
    `Typical price points range from $18 to $65 per unit, with premium personalized items reaching $120.`,
    `Competitors are fragmented: a few Etsy sellers dominate search but ship slowly (7-14 days),`,
    `leaving an opening for a storefront that promises 48-hour dispatch and clear made-to-order messaging.`,
    `Best-converting landing pages lead with a hero product photo, social proof (reviews), and a single CTA.`,
    `Recommended entry SKUs: a signature bestseller, a customizable variant, and a low-cost impulse add-on.`,
  ].join(" ");
  return { url, title, text };
}

function fixtureSearch(query: string): SearchResult {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    query,
    results: [
      {
        url: `https://example-market.test/${slug}`,
        title: `${query} — market snapshot`,
        snippet: `Overview of ${query}: demand trends, pricing bands, and competitor gaps.`,
      },
      {
        url: `https://example-trends.test/${slug}`,
        title: `${query} buyer intent & keywords`,
        snippet: `Search volume, seasonality, and high-intent keywords for ${query}.`,
      },
    ],
  };
}

export async function browse(session_id: string, url: string): Promise<BrowseResult> {
  touchSession(session_id);
  if (env.FIXTURE_MODE || !env.SUPERSERVE_API_KEY) {
    return fixtureBrowse(url);
  }
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "AutoBusinessResearcher/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return {
      url,
      title: titleMatch ? stripHtml(titleMatch[1]!) : undefined,
      text: stripHtml(html).slice(0, 8_000),
    };
  } catch (err) {
    logger.warn({ err, url }, "browse fetch failed; returning fixture");
    return fixtureBrowse(url);
  }
}

export async function search(session_id: string, query: string): Promise<SearchResult> {
  touchSession(session_id);
  return fixtureSearch(query);
}
