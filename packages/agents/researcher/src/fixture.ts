import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AgentContext } from "@autobiz/shared";
import { ResearchFixtureSchema, type ResearchFixture, type ResearchPayload } from "./schemas.js";
import { noteForSource } from "./memory.js";
import type { Emit, MemoryWrite } from "./orch.js";

const FIXTURE_FILE = "3dp-niches.json";
const EVENT_DELAY_MS = 500;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function loadFixture(): ResearchFixture {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/fixture.js → ../fixtures/3dp-niches.json
  const path = join(here, "..", "fixtures", FIXTURE_FILE);
  const raw = readFileSync(path, "utf8");
  return ResearchFixtureSchema.parse(JSON.parse(raw));
}

export async function runFixtureFlow(
  ctx: AgentContext,
  emit: Emit,
  writeMemory: MemoryWrite,
): Promise<void> {
  const fixture = loadFixture();

  await emit({
    type: "thought",
    content: `[fixture] researching "${ctx.plan.vertical ?? "market"}" for goal: ${ctx.plan.goal}`,
  });
  await sleep(EVENT_DELAY_MS);

  await emit({
    type: "thought",
    content: `[fixture] plan-of-inquiry: ${fixture.sources.map((s) => s.slug).join(", ")}`,
  });
  await sleep(EVENT_DELAY_MS);

  for (const src of fixture.sources) {
    await emit({
      type: "action",
      content: `browse ${src.url}`,
      metadata: { source_slug: src.slug, source_url: src.url },
    });
    await sleep(EVENT_DELAY_MS);

    const note = noteForSource(src, ctx.project_id);
    await writeMemory(note.path, note.content);

    await emit({
      type: "thought",
      content: `note ${note.path} · ${src.title}`,
      metadata: { memory_path: note.path },
    });
    await sleep(EVENT_DELAY_MS);
  }

  const payload: ResearchPayload = {
    candidates: fixture.candidates,
    top_pick: fixture.top_pick,
    confidence: fixture.confidence,
  };

  await emit({
    type: "result",
    content: `top pick: ${payload.top_pick} (${fixture.candidates.length} candidates)`,
    confidence: payload.confidence,
    metadata: { research: payload },
  });
}
