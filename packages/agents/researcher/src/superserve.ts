const DEFAULT_TIMEOUT_MS = 30_000;

export type Session = { session_id: string; browser_ws_url: string };

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${init.method ?? "GET"} ${url} → ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    return await fn();
  }
}

export class Superserve {
  private session: Session | null = null;

  constructor(private readonly intUrl: string) {}

  private async ensureSession(): Promise<Session> {
    if (this.session) return this.session;
    this.session = await withRetry(() =>
      fetchJson<Session>(
        `${this.intUrl}/superserve/session`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ttl_sec: 120 }),
        },
        DEFAULT_TIMEOUT_MS,
      ),
    );
    return this.session;
  }

  async browse(url: string): Promise<{ url: string; text: string; title?: string }> {
    const session = await this.ensureSession();
    return withRetry(() =>
      fetchJson<{ url: string; text: string; title?: string }>(
        `${this.intUrl}/superserve/session/${encodeURIComponent(session.session_id)}/browse`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        },
        DEFAULT_TIMEOUT_MS,
      ),
    );
  }

  async search(query: string): Promise<{ query: string; results: Array<{ url: string; title: string; snippet: string }> }> {
    const session = await this.ensureSession();
    return withRetry(() =>
      fetchJson<{
        query: string;
        results: Array<{ url: string; title: string; snippet: string }>;
      }>(
        `${this.intUrl}/superserve/session/${encodeURIComponent(session.session_id)}/search`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
        },
        DEFAULT_TIMEOUT_MS,
      ),
    );
  }

  async close(): Promise<void> {
    if (!this.session) return;
    const id = this.session.session_id;
    this.session = null;
    try {
      await fetch(`${this.intUrl}/superserve/session/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // best-effort teardown
    }
  }
}
