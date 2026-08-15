import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  TeracRawResponseSchema,
  type TeracAsk,
  type TeracRawResponse,
} from "@autobiz/shared";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Fixture-mode canned response lookup. Search order:
 *  1. `packages/agents/verifier/fixtures/terac-responses/<topic>.json` (bundled)
 *  2. repo-root `fixtures/terac-responses/<topic>.json` (Track 5 canonical)
 *  3. synthetic response generated from the ask
 */
export function loadCannedResponse(topic: string, ask: TeracAsk, askId: string): TeracRawResponse {
  const filename = `${sanitize(topic)}.json`;
  const candidates = [
    // dist/ is one below src/; look for sibling `fixtures/terac-responses/`
    resolve(HERE, "..", "fixtures", "terac-responses", filename),
    resolve(HERE, "..", "..", "fixtures", "terac-responses", filename),
    resolve(HERE, "..", "..", "..", "..", "..", "fixtures", "terac-responses", filename),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf8"));
      const parsed = TeracRawResponseSchema.safeParse({
        ...raw,
        ask_id: askId,
        project_id: ask.project_id,
        received_at: raw.received_at ?? new Date().toISOString(),
      });
      if (parsed.success) return parsed.data;
    } catch {
      // fall through
    }
  }

  return synthesizeResponse(ask, askId);
}

function synthesizeResponse(ask: TeracAsk, askId: string): TeracRawResponse {
  const target = ask.target_responses;
  const options = ask.options?.length ? ask.options : ["yes", "no", "maybe"];
  const responses = Array.from({ length: target }).map((_, i) => {
    const answer = options[i % options.length] ?? "yes";
    return {
      answer,
      reasoning: `synthetic respondent ${i + 1}`,
      respondent_id: `synth-${i + 1}`,
    };
  });
  return {
    ask_id: askId,
    project_id: ask.project_id,
    responses,
    received_at: new Date().toISOString(),
  };
}

function sanitize(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

/**
 * "Feels real on stage" delay — only applied when VERIFIER_STAGE_DELAY=true,
 * so contract tests are not slowed down.
 */
export async function stageDelay(): Promise<void> {
  if (process.env.VERIFIER_STAGE_DELAY !== "true") return;
  const ms = Number(process.env.VERIFIER_STAGE_DELAY_MS ?? "8000");
  await new Promise((r) => setTimeout(r, ms));
}

// Silence unused-import warnings for the `join` helper if TS ever complains.
void join;
