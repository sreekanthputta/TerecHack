import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import type { BusinessPlan } from "@autobiz/shared";
import {
  ResearchCandidateSchema,
  type ResearchCandidate,
  type ResearchPayload,
} from "./schemas.js";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export type InquiryItem = {
  slug: string;
  kind: "search" | "browse";
  target: string;
  rationale: string;
};

const InquirySchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
        kind: z.enum(["search", "browse"]),
        target: z.string().min(1),
        rationale: z.string().min(1),
      }),
    )
    .min(3)
    .max(5),
});

const SynthesisSchema = z.object({
  candidates: z.array(ResearchCandidateSchema).min(1),
  top_pick: z.string().min(1),
  reasoning: z.string().min(1),
});

function extractJson<T>(schema: z.ZodType<T>, text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  return schema.parse(JSON.parse(candidate));
}

export class LLM {
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
  }

  async planInquiry(plan: BusinessPlan): Promise<InquiryItem[]> {
    const prompt = [
      `You are a market researcher. Produce 3–5 concrete sources to inspect.`,
      `Vertical: ${plan.vertical ?? "unspecified"}`,
      `Goal: ${plan.goal}`,
      `Budget: $${plan.budget_usd}`,
      ``,
      `Respond as JSON ONLY: {"items":[{"slug":"kebab-case","kind":"search"|"browse","target":"url or query","rationale":"why"}, ...]}`,
      `"search" → target is a free-text query; "browse" → target is an https URL.`,
    ].join("\n");

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = extractJson(InquirySchema, text);
    return parsed.items;
  }

  async synthesize(
    plan: BusinessPlan,
    sources: Array<{ slug: string; url: string; text: string }>,
  ): Promise<{ candidates: ResearchCandidate[]; top_pick: string; reasoning: string }> {
    const bundle = sources
      .map((s, i) => `[${i + 1}] slug=${s.slug} url=${s.url}\n${s.text.slice(0, 1500)}`)
      .join("\n\n---\n\n");
    const prompt = [
      `Synthesize product opportunities from the sources below.`,
      `Vertical: ${plan.vertical ?? "unspecified"}. Goal: ${plan.goal}.`,
      ``,
      `Sources:\n${bundle}`,
      ``,
      `Return JSON ONLY:`,
      `{"candidates":[{"name":"…","evidence":"…","price_range":[low,high],"monthly_sales_est":123}, …], "top_pick":"name", "reasoning":"why"}`,
      `Only include candidates the sources support. Do not invent numbers.`,
    ].join("\n");

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return extractJson(SynthesisSchema, text);
  }
}

/**
 * Cap confidence at 0.6 unless we have ≥3 corroborating sources.
 * Applied after LLM synthesis; the LLM never sets the final confidence.
 */
export function scoreConfidence(sourceCount: number, base: number): number {
  const clamped = Math.max(0, Math.min(1, base));
  if (sourceCount >= 3) return clamped;
  return Math.min(clamped, 0.6);
}

export function toResearchPayload(
  syn: { candidates: ResearchCandidate[]; top_pick: string },
  sourceCount: number,
  baseConfidence = 0.75,
): ResearchPayload {
  return {
    candidates: syn.candidates,
    top_pick: syn.top_pick,
    confidence: scoreConfidence(sourceCount, baseConfidence),
  };
}
