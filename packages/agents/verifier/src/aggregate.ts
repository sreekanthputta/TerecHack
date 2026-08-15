import { DecisionSideSchema, type DecisionSide, type TeracRawResponse } from "@autobiz/shared";
import { askForJson } from "./claude.js";
import type { TriggerEvent } from "./trigger.js";

const SCHEMA_HINT = `{
  "aggregate": "human-readable synthesis, under 300 chars, quotable in a UI card",
  "value": <any JSON — the decided value that supersedes the trigger event>,
  "confidence": <number 0..1, reflecting response consensus>,
  "reasoning": "one or two sentences citing patterns you saw in the responses"
}`;

export type AggregateOutput = {
  aggregate: string;
  after: DecisionSide;
};

/**
 * Verifier-owned aggregation. Turns raw crowd responses into a single
 * `aggregate` string and an `after` DecisionSide. NEVER trusts any aggregate
 * that may have come from the wire.
 */
export async function aggregateResponses(input: {
  raw: TeracRawResponse;
  trigger: TriggerEvent | undefined;
  topic: string;
}): Promise<AggregateOutput> {
  const { raw, trigger, topic } = input;

  const prompt = [
    `Topic under verification: ${topic}`,
    trigger
      ? `The prior (low-confidence) call was: "${trigger.content}" (confidence ${trigger.confidence ?? "?"}).`
      : "No explicit prior decision. Summarize the crowd view.",
    `Received ${raw.responses.length} raw responses:`,
    raw.responses
      .slice(0, 40)
      .map((r, i) => `- [${i + 1}] answer=${JSON.stringify(r.answer)} reasoning=${JSON.stringify(r.reasoning ?? "")}`)
      .join("\n"),
    `Write the aggregate as if it will be shown on a decision card. Do not exceed 300 characters.`,
  ].join("\n\n");

  const rawJson = await askForJson(prompt, SCHEMA_HINT);
  const claudeParsed = rawJson ? safeParse(rawJson) : undefined;
  if (claudeParsed) return claudeParsed;

  return fallbackAggregate(raw, trigger);
}

function safeParse(rawJson: string): AggregateOutput | undefined {
  try {
    const obj = JSON.parse(rawJson) as Record<string, unknown>;
    const aggregate = String(obj.aggregate ?? "").slice(0, 300);
    const after = DecisionSideSchema.parse({
      value: obj.value ?? null,
      confidence: typeof obj.confidence === "number" ? clamp01(obj.confidence) : 0.7,
      reasoning: String(obj.reasoning ?? "consensus from Terac panel"),
    });
    if (!aggregate) return undefined;
    return { aggregate, after };
  } catch {
    return undefined;
  }
}

/**
 * Deterministic fallback: pick the modal answer, count support, generate a
 * bland-but-useful aggregate string.
 */
function fallbackAggregate(raw: TeracRawResponse, trigger: TriggerEvent | undefined): AggregateOutput {
  const counts = new Map<string, number>();
  for (const r of raw.responses) {
    const k = r.answer.trim().toLowerCase();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topAnswer, topCount] = sorted[0] ?? ["inconclusive", 0];
  const total = raw.responses.length || 1;
  const confidence = clamp01(topCount / total);

  const aggregate = `${topCount}/${total} respondents converged on "${truncate(topAnswer, 120)}".`.slice(0, 300);

  return {
    aggregate,
    after: {
      value: topAnswer,
      confidence,
      reasoning: trigger
        ? `Fallback tally over ${total} responses. Prior confidence: ${trigger.confidence ?? "unknown"}.`
        : `Fallback tally over ${total} responses.`,
    },
  };
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
