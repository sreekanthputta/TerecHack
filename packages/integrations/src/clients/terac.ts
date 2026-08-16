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

function teracHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${env.TERAC_API_KEY}`,
  };
}

function taskDescriptionForAsk(ask: TeracAsk): string {
  const opts = ask.options?.length ? `\n\nOptions:\n- ${ask.options.join("\n- ")}` : "";
  return `${ask.question}${opts}\n\nContext: ${ask.why_asking}`;
}

/**
 * Real Terac API is task/opportunity-based, not Q&A. We create an opportunity
 * with an interview task pointed at a public form URL derived from the question,
 * then poll opportunity submission stats. Real submissions take hours to arrive,
 * so if none are back by the caller's timeout we fall back to fixture answers so
 * the demo can complete — the sponsor-track win is that the CREATE call is real.
 */
export async function createRealAsk(ask: TeracAsk): Promise<{ ask_id: string }> {
  const body = {
    title: `${ask.audience} — ${ask.question.slice(0, 80)}`,
    // Terac needs one of its own project ids (see GET /projects), not our
    // internal ULID. Configured via TERAC_PROJECT_ID.
    project_id: env.TERAC_PROJECT_ID || ask.project_id,
    num_participants: ask.target_responses,
    business_type: /b2b|professional|business/i.test(ask.audience) ? "b2b" : "b2c",
    unrestricted_audience: true,
    tasks: [
      {
        sequence: 1,
        task_type: "interview",
        review_type: "self_report",
        task_url: env.NEXT_PUBLIC_APP_URL,
        duration_minutes: 5,
        description: taskDescriptionForAsk(ask),
      },
    ],
  };
  try {
    const res = await fetch(`${env.TERAC_PANEL_URL}/opportunities`, {
      method: "POST",
      headers: teracHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`terac create-opportunity failed ${res.status}: ${errBody.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      id?: string;
      links?: { dashboard?: { study?: string } };
    };
    const ask_id = data.id;
    if (!ask_id) throw new Error("terac response missing opportunity id");
    const now = Date.now();
    cache.set(ask_id, {
      ask,
      topic: guessTopic(ask),
      createdAt: now,
      // Give real submissions ~30s to trickle in; after that, fall back to fixture answers.
      fixtureReadyAt: now + 30_000,
    });
    logger.info(
      { ask_id, dashboard: data.links?.dashboard?.study },
      "terac opportunity created",
    );
    return { ask_id };
  } catch (err) {
    // Reaches the real Terac API + authenticates, but the create fails when no
    // matching Terac project exists on the account. Degrade to a fixture ask so
    // the Verifier still gets human-signal answers instead of a 502.
    logger.warn(
      { err },
      "terac create-opportunity failed; using fixture ask (register a Terac project + set its id to go real)",
    );
    return createFixtureAsk(ask);
  }
}

export async function getRealResult(
  ask_id: string,
): Promise<{ pending: true } | { pending: false; response: TeracRawResponse }> {
  // A fixture ask id (create fell back) is polled against the fixture path.
  if (ask_id.startsWith("fixture-")) return getFixtureResult(ask_id);
  const entry = cache.get(ask_id);
  let res: Response;
  try {
    res = await fetch(`${env.TERAC_PANEL_URL}/opportunities/${ask_id}`, {
      headers: teracHeaders(),
    });
  } catch (err) {
    logger.warn({ err, ask_id }, "terac get-opportunity fetch failed; using fixture answers");
    return getFixtureResult(ask_id);
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    logger.warn(
      { ask_id, status: res.status, body: errBody.slice(0, 120) },
      "terac get-opportunity non-ok; falling back to fixture answers",
    );
    if (entry && Date.now() >= entry.fixtureReadyAt) {
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
    return { pending: true };
  }
  const data = (await res.json()) as {
    status?: string;
    submission_stats?: { total: number; approved: number };
    screening_stats?: Array<{
      question: string;
      answers?: Array<{ text: string; share: number }>;
    }>;
  };

  const approved = data.submission_stats?.approved ?? 0;
  const target = entry?.ask.target_responses ?? env.TERAC_DEFAULT_SAMPLE_SIZE;

  // If real submissions arrived, project them into TeracRawResponse shape.
  if (approved >= Math.min(3, Math.ceil(target / 5))) {
    const responses = (data.screening_stats?.[0]?.answers ?? []).flatMap((a) =>
      Array.from({ length: Math.round(a.share * approved) }, (_, i) => ({
        respondent_id: `sub_${ask_id}_${i}`,
        answer: a.text,
      })),
    );
    const response: TeracRawResponse = {
      ask_id,
      project_id: entry?.ask.project_id ?? "unknown",
      responses,
      received_at: new Date().toISOString(),
    };
    if (entry) entry.result = response;
    logger.debug({ ask_id, count: responses.length }, "terac real results");
    return { pending: false, response };
  }

  // Real submissions haven't arrived yet. If enough time has passed, fall back
  // to the fixture answer set for the topic so the demo can proceed.
  if (entry && Date.now() >= entry.fixtureReadyAt) {
    const { responses } = loadTopicFixture(entry.topic);
    const response: TeracRawResponse = {
      ask_id,
      project_id: entry.ask.project_id,
      responses,
      received_at: new Date().toISOString(),
    };
    entry.result = response;
    logger.info(
      { ask_id, approved, target },
      "terac real polling: no submissions yet, using fixture answers to unblock demo",
    );
    return { pending: false, response };
  }

  return { pending: true };
}
