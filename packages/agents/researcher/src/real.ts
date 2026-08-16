import type { AgentContext } from "@autobiz/shared";

import { LLM, toResearchPayload, type InquiryItem } from "./llm.js";
import { noteForSource } from "./memory.js";
import type { Emit, MemoryWrite } from "./orch.js";
import { ResearchSourceSchema, type ResearchSource } from "./schemas.js";
import { Superserve } from "./superserve.js";

export type RealDeps = {
  ctx: AgentContext;
  emit: Emit;
  writeMemory: MemoryWrite;
  llm: LLM;
  browser: Superserve;
};

function summarize(text: string, max = 400): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

// A browse fetch can echo back a non-URL target (LLM sometimes omits the
// scheme), which then fails ResearchSourceSchema's .url() and drops the source.
// Coerce to a valid absolute URL so usable sources aren't discarded.
function coerceUrl(raw: string, item: InquiryItem): string {
  const tryUrl = (s: string): string | null => {
    try {
      return new URL(s).toString();
    } catch {
      return null;
    }
  };
  const bare = (s: string) => s.replace(/^https?:\/\//, "").replace(/^\/+/, "");
  return (
    tryUrl(raw) ??
    tryUrl(`https://${bare(raw)}`) ??
    tryUrl(`https://${bare(item.target)}`) ??
    `https://source.local/${item.slug}`
  );
}

async function executeItem(
  browser: Superserve,
  item: InquiryItem,
): Promise<{ url: string; text: string; title?: string }> {
  if (item.kind === "browse") {
    return browser.browse(item.target);
  }
  const found = await browser.search(item.target);
  const first = found.results[0];
  if (!first) {
    return { url: `search://${item.target}`, text: "no results", title: item.target };
  }
  const page = await browser.browse(first.url);
  return { ...page, title: page.title ?? first.title };
}

export async function runRealFlow(deps: RealDeps): Promise<void> {
  const { ctx, emit, writeMemory, llm, browser } = deps;

  await emit({
    type: "thought",
    content: `researching vertical "${ctx.plan.vertical ?? "unspecified"}" for goal: ${ctx.plan.goal}`,
  });

  const items = await llm.planInquiry(ctx.plan);
  await emit({
    type: "thought",
    content: `plan-of-inquiry: ${items.map((i) => `${i.kind}:${i.slug}`).join(", ")}`,
    metadata: { inquiry: items },
  });

  const gathered: Array<{ slug: string; url: string; text: string }> = [];
  const memoryNotes: ResearchSource[] = [];

  for (const item of items) {
    await emit({
      type: "action",
      content: `${item.kind} ${item.target}`,
      metadata: { source_slug: item.slug, rationale: item.rationale },
    });

    let page: { url: string; text: string; title?: string };
    try {
      page = await executeItem(browser, item);
    } catch (err) {
      await emit({
        type: "error",
        content: `source ${item.slug} failed: ${(err as Error).message}`,
        metadata: { source_slug: item.slug },
      });
      continue;
    }

    const parsed = ResearchSourceSchema.safeParse({
      slug: item.slug,
      title: page.title ?? item.slug,
      url: coerceUrl(page.url, item),
      summary:
        summarize(page.text) ||
        `Reviewed ${page.title ?? item.slug} for ${ctx.plan.vertical ?? ctx.plan.goal}.`,
      evidence: item.rationale,
    });
    if (!parsed.success) {
      await emit({
        type: "error",
        content: `source ${item.slug} produced invalid note`,
        metadata: { source_slug: item.slug, issues: parsed.error.issues },
      });
      continue;
    }
    const note = noteForSource(parsed.data, ctx.project_id);
    await writeMemory(note.path, note.content);
    memoryNotes.push(parsed.data);
    gathered.push({ slug: item.slug, url: page.url, text: page.text });

    await emit({
      type: "thought",
      content: `note ${note.path} · ${parsed.data.title}`,
      metadata: { memory_path: note.path },
    });
  }

  if (gathered.length === 0) {
    await emit({
      type: "result",
      content: `researcher: no sources produced usable content`,
      confidence: 0.2,
      metadata: {
        research: { candidates: [], top_pick: "", confidence: 0.2 },
      },
    });
    return;
  }

  const synthesis = await llm.synthesize(ctx.plan, gathered);
  const payload = toResearchPayload(synthesis, gathered.length, 0.75);

  await emit({
    type: "result",
    content: `top pick: ${payload.top_pick} · ${payload.candidates.length} candidates · confidence ${payload.confidence.toFixed(2)}`,
    confidence: payload.confidence,
    metadata: { research: payload, reasoning: synthesis.reasoning },
  });
}
