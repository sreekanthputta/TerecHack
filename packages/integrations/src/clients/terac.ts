import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { TeracAsk, TeracRawResponse } from "@autobiz/shared";
import { env } from "../env.js";
import { logger } from "../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = resolve(__dirname, "..", "..", "fixtures", "terac-responses");

const TTL_MS = 10 * 60 * 1000;

type CachedAsk = {
  ask: TeracAsk;
  createdAt: number;
  topic: string;
  fixtureReadyAt: number;
  result?: TeracRawResponse;
};

const cache = new Map<string, CachedAsk>();

function askIdFromAsk(ask: TeracAsk): string {
  const payload = JSON.stringify({
    project_id: ask.project_id,
    question: ask.question,
    audience: ask.audience,
    options: ask.options ?? [],
  });
  const hash = createHash("sha1").update(payload).digest("hex").slice(0, 10);
  return `fixture-${hash}`;
}

function guessTopic(ask: TeracAsk): string {
  const q = ask.question.toLowerCase();
  const w = ask.why_asking.toLowerCase();
  const both = `${q} ${w}`;
  if (both.includes("price") || both.includes("$") || both.includes("pricing"))
    return "pricing";
  if (both.includes("headline") || both.includes("positioning") || both.includes("tagline"))
    return "positioning";
  if (both.includes("niche") || both.includes("vertical") || both.includes("category"))
    return "niche-validation";
  return "default";
}

function loadTopicFixture(topic: string): {
  responses: TeracRawResponse["responses"];
} {
  const primary = resolve(FIXTURE_DIR, `${topic}.json`);
  const fallback = resolve(FIXTURE_DIR, "default.json");
  const path = existsSync(primary) ? primary : fallback;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return { responses: raw.responses };
}

function pruneCache(now: number): void {
  for (const [id, entry] of cache) {
    if (now - entry.createdAt > TTL_MS) cache.delete(id);
  }
}

export function createFixtureAsk(ask: TeracAsk): { ask_id: string } {
  const now = Date.now();
  pruneCache(now);
  const ask_id = askIdFromAsk(ask);
  const topic = guessTopic(ask);
  cache.set(ask_id, {
    ask,
    topic,
    createdAt: now,
    fixtureReadyAt: now + 8_000,
  });
  return { ask_id };
}

export function getFixtureResult(
  ask_id: string,
): { pending: true } | { pending: false; response: TeracRawResponse } {
  const now = Date.now();
  pruneCache(now);
  const entry = cache.get(ask_id);
  if (!entry) return { pending: true };
  if (now < entry.fixtureReadyAt) return { pending: true };
  if (entry.result) return { pending: false, response: entry.result };
  const { responses } = loadTopicFixture(entry.topic);
  const response: TeracRawResponse = {
    ask_id,
    project_id: entry.ask.project_id,
    responses,
    received_at: new Date().toISOString(),
  };
  entry.result = response;
  return { pending: false, response };
}

export async function createRealAsk(ask: TeracAsk): Promise<{ ask_id: string }> {
  const res = await fetch(`${env.TERAC_PANEL_URL}/studies`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.TERAC_API_KEY}`,
      "x-terac-org": env.TERAC_ORG_ID,
    },
    body: JSON.stringify({
      project_id: ask.project_id,
      question: ask.question,
      audience: ask.audience,
      options: ask.options,
      target_responses: ask.target_responses,
      why_asking: ask.why_asking,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`terac create-study failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { ask_id?: string; id?: string };
  const ask_id = data.ask_id ?? data.id;
  if (!ask_id) throw new Error("terac response missing ask_id/id");
  const now = Date.now();
  cache.set(ask_id, {
    ask,
    topic: guessTopic(ask),
    createdAt: now,
    fixtureReadyAt: now,
  });
  return { ask_id };
}

export async function getRealResult(
  ask_id: string,
): Promise<{ pending: true } | { pending: false; response: TeracRawResponse }> {
  const entry = cache.get(ask_id);
  const res = await fetch(`${env.TERAC_PANEL_URL}/studies/${ask_id}/results`, {
    headers: {
      authorization: `Bearer ${env.TERAC_API_KEY}`,
      "x-terac-org": env.TERAC_ORG_ID,
    },
  });
  if (res.status === 202) return { pending: true };
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`terac results fetch failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    status?: string;
    responses?: TeracRawResponse["responses"];
    received_at?: string;
    project_id?: string;
  };
  if (data.status && data.status !== "done" && data.status !== "complete") {
    return { pending: true };
  }
  const response: TeracRawResponse = {
    ask_id,
    project_id: data.project_id ?? entry?.ask.project_id ?? "unknown",
    responses: data.responses ?? [],
    received_at: data.received_at ?? new Date().toISOString(),
  };
  if (entry) entry.result = response;
  logger.debug({ ask_id, count: response.responses.length }, "terac raw result");
  return { pending: false, response };
}
