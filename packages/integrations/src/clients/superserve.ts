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
