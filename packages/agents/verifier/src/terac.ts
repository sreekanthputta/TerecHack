import { TeracRawResponseSchema, type TeracAsk, type TeracRawResponse } from "@autobiz/shared";

/**
 * Post the ask to the integrations layer and receive an ask_id.
 */
export async function postAsk(intUrl: string, ask: TeracAsk): Promise<string> {
  const res = await fetch(`${intUrl}/terac/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(ask),
  });
  if (!res.ok) throw new Error(`terac/ask failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { ask_id?: string };
  if (!body.ask_id) throw new Error("terac/ask returned no ask_id");
  return body.ask_id;
}

/**
 * Poll for results until we get a non-202 response or the timeout elapses.
 * Returns the raw responses. Callers must aggregate themselves.
 */
export async function pollResult(
  intUrl: string,
  askId: string,
  opts: { intervalMs?: number; timeoutSec?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<TeracRawResponse> {
  const intervalMs = opts.intervalMs ?? 5000;
  const timeoutSec = opts.timeoutSec ?? 300;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const deadline = Date.now() + timeoutSec * 1000;

  while (Date.now() < deadline) {
    const res = await fetch(`${intUrl}/terac/result/${encodeURIComponent(askId)}`);
    if (res.status === 202) {
      await sleep(intervalMs);
      continue;
    }
    if (!res.ok) throw new Error(`terac/result failed: ${res.status} ${await res.text()}`);
    const body = await res.json();
    return TeracRawResponseSchema.parse(body);
  }
  throw new Error("terac/result timeout");
}
