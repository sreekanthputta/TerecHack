import type { AgentContext, BusinessPlan, DecisionRecord } from "@autobiz/shared";

/**
 * Decide whether this decision changes a plan-level value. Currently we look
 * at three signals in the decision topic and trigger metadata:
 *   - "pricing" / "price"
 *   - "vertical" / "niche"
 *   - "vendor"
 *
 * If so, produce a new BusinessPlan with an incremented version. Otherwise
 * return `undefined`.
 */
export function derivePlanUpdate(
  ctx: AgentContext,
  decision: DecisionRecord,
): BusinessPlan | undefined {
  const topic = decision.topic.toLowerCase();
  const plan = ctx.plan;
  const value = decision.after.value;

  if (topic.includes("vertical") || topic.includes("niche")) {
    const vertical = typeof value === "string" && value.trim() ? value.trim() : plan.vertical;
    if (vertical === plan.vertical) return undefined;
    return { ...plan, version: plan.version + 1, vertical };
  }

  if (topic.includes("price") || topic.includes("pricing")) {
    // Pricing lives outside `BusinessPlan` fields, so we only bump the version
    // to record that a pricing decision landed. Downstream agents read
    // `decisions/` for the actual number.
    return { ...plan, version: plan.version + 1 };
  }

  if (topic.includes("vendor")) {
    return { ...plan, version: plan.version + 1 };
  }

  return undefined;
}
