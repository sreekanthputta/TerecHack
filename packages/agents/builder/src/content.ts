import { z } from "zod";
import type { BusinessPlan } from "@autobiz/shared";
import type { TemplateId } from "./template.js";

export const ProductSchema = z.object({
  name: z.string().min(1).max(80),
  price_usd: z.number().positive().max(9999),
  blurb: z.string().min(1).max(280),
});
export type Product = z.infer<typeof ProductSchema>;

export const LandingCopySchema = z.object({
  hero: z.string().min(1).max(120),
  subheadline: z.string().min(1).max(200),
  value_props: z.array(z.string().min(1).max(120)).min(2).max(5),
  products: z.array(ProductSchema).min(1).max(12),
  brand_name: z.string().min(1).max(60),
  cta_label: z.string().min(1).max(30),
});
export type LandingCopy = z.infer<typeof LandingCopySchema>;

/**
 * Generate landing-page copy. In FIXTURE_MODE we return a canned deterministic
 * payload derived from the plan; otherwise we call Claude and zod-validate its
 * JSON response.
 */
export async function generateCopy(opts: {
  plan: BusinessPlan;
  template: TemplateId;
  sku_count: number;
  fixture_mode: boolean;
  regen_regions?: Array<keyof LandingCopy>;
  previous?: LandingCopy;
}): Promise<LandingCopy> {
  if (opts.fixture_mode) {
    const canned = cannedCopy(opts.plan, opts.sku_count);
    if (opts.previous && opts.regen_regions?.length) {
      return mergeRegions(opts.previous, canned, opts.regen_regions);
    }
    return canned;
  }
  const generated = await callClaude(opts);
  const parsed = LandingCopySchema.parse(generated);
  if (opts.previous && opts.regen_regions?.length) {
    return mergeRegions(opts.previous, parsed, opts.regen_regions);
  }
  return parsed;
}

function mergeRegions(prev: LandingCopy, next: LandingCopy, regions: Array<keyof LandingCopy>): LandingCopy {
  const merged: LandingCopy = { ...prev };
  for (const key of regions) {
    (merged as Record<string, unknown>)[key] = next[key];
  }
  return merged;
}

function cannedCopy(plan: BusinessPlan, skuCount: number): LandingCopy {
  const brand = plan.vertical
    .split(/[-\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  const products: Product[] = Array.from({ length: Math.max(1, skuCount) }, (_, i) => ({
    name: `${brand} Item ${i + 1}`,
    price_usd: 19 + i * 5,
    blurb: `Hand-picked ${plan.vertical} product #${i + 1}. Ships in 48h.`,
  }));
  const firstSentence = plan.goal.split(".")[0] ?? plan.goal;
  return {
    hero: `${brand}: ${firstSentence.slice(0, 100)}`,
    subheadline: `Small-batch ${plan.vertical} — ready to ship, budget ${plan.budget_usd} USD.`,
    value_props: [
      "Fast shipping (48h)",
      "Small-batch quality",
      "Buy directly from the maker",
    ],
    products,
    brand_name: brand,
    cta_label: "Buy Now",
  };
}

async function callClaude(opts: {
  plan: BusinessPlan;
  template: TemplateId;
  sku_count: number;
}): Promise<unknown> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(opts.plan, opts.template, opts.sku_count);
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }],
  });
  const text = res.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return JSON");
  return JSON.parse(jsonMatch[0]);
}

function buildPrompt(plan: BusinessPlan, template: TemplateId, skuCount: number): string {
  return [
    `You write landing-page copy for a "${template}" template.`,
    `Business goal: ${plan.goal}`,
    `Vertical: ${plan.vertical}. Budget: ${plan.budget_usd} USD. Products: ${skuCount}.`,
    "",
    "Return ONLY a JSON object with keys:",
    "  hero (string, <=120 chars), subheadline (<=200), value_props (2-5 strings <=120 each),",
    `  products (array of ${skuCount} {name, price_usd, blurb}), brand_name (<=60), cta_label (<=30).`,
    "No markdown, no prose outside the JSON.",
  ].join("\n");
}
