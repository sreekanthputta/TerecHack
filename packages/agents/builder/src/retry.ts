import type { Bug } from "@autobiz/shared";
import type { LandingCopy } from "./content.js";

export type Region = keyof LandingCopy;

/**
 * Map a Bug's `where`/`observed` fields to the LandingCopy regions we should
 * regenerate. Deliberately narrow — we don't reshuffle the entire page.
 */
export function regionsForBug(bug: Bug): Region[] {
  const s = `${bug.where} ${bug.observed} ${bug.expected}`.toLowerCase();
  const out = new Set<Region>();
  if (/hero|headline|title/.test(s)) out.add("hero");
  if (/sub|tagline|copy/.test(s)) out.add("subheadline");
  if (/value|benefit|feature/.test(s)) out.add("value_props");
  if (/cta|button|call.?to.?action|buy/.test(s)) out.add("cta_label");
  if (/price|cart|checkout|sku|product|catalog|item/.test(s)) out.add("products");
  if (/brand|name|logo/.test(s)) out.add("brand_name");
  if (out.size === 0) out.add("products");
  return [...out];
}

export function fixApproach(bug: Bug, regions: Region[]): string {
  return `bug ${bug.bug_id} (${bug.severity}) at ${bug.where}: regen ${regions.join(", ")} — expected "${bug.expected}"`;
}

export function unionRegions(bugs: Bug[]): Region[] {
  const set = new Set<Region>();
  for (const b of bugs) for (const r of regionsForBug(b)) set.add(r);
  return [...set];
}
