import type { BusinessPlan } from "@autobiz/shared";

export type TemplateId = "minimal-product" | "story-first" | "catalog";

/**
 * Pick a landing-page template by SKU count. We infer SKU count from the plan
 * (agent task strings + goal) since Builder only receives memory paths, not the
 * research payload itself.
 */
export function pickTemplate(plan: BusinessPlan): { id: TemplateId; sku_count: number; reason: string } {
  const skuCount = inferSkuCount(plan);
  if (skuCount >= 4) {
    return { id: "catalog", sku_count: skuCount, reason: `${skuCount} SKUs → catalog grid` };
  }
  if (skuCount <= 1) {
    return { id: "minimal-product", sku_count: 1, reason: "single product → minimal hero" };
  }
  return { id: "story-first", sku_count: skuCount, reason: `${skuCount} SKUs → story-first narrative` };
}

function inferSkuCount(plan: BusinessPlan): number {
  const haystack = [plan.goal, ...plan.agents.map((a) => a.task)].join(" ");
  const match = haystack.match(/(\d+)\s*SKU/i);
  if (match) return Number(match[1]);
  return 1;
}
