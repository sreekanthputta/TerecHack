import type { AgentContext } from "@autobiz/shared";
import type { ReplayInputs } from "./context.js";

export function buildDesignDocument(ctx: AgentContext, inputs: ReplayInputs): string {
  const lines: string[] = [];
  lines.push(`# QA design document — ${ctx.project_id}`);
  lines.push("");
  lines.push(`**Product summary:** ${inputs.productSummary}`);
  lines.push(`**Landing URL:** ${inputs.landingUrl}`);
  lines.push(`**Builder version under test:** v${inputs.builderVersion}`);
  lines.push("");
  lines.push("## Golden path");
  lines.push("1. Load the home page and confirm it renders without console errors.");
  lines.push("2. Click into a SKU detail page.");
  lines.push("3. Add the SKU to the cart.");
  lines.push("4. Proceed to checkout via the Stripe payment link.");
  lines.push("5. Confirm the Stripe hosted checkout page loads with the correct SKU + price.");
  lines.push("");
  lines.push("## Viewports");
  lines.push("- Desktop: 1280×800");
  lines.push("- Mobile: 390×844 (iPhone 14 baseline — required)");
  lines.push("");
  lines.push("## SKUs");
  lines.push("SKUs and pricing are enumerated on the storefront home page. Verify each SKU has:");
  lines.push("- A price visible on both the listing page and detail page.");
  lines.push("- An add-to-cart control that reaches the Stripe payment link.");
  lines.push("- No 404 or 5xx on the cart route after add-to-cart.");
  lines.push("");

  const studies = ctx.plan.terac_studies_planned ?? [];
  if (studies.length > 0) {
    lines.push("## Explicit scenarios from Terac studies");
    for (const s of studies) {
      lines.push(`- [${s.audience}] ${s.topic}`);
    }
    lines.push("");
  }

  if (inputs.builderVersion > 1 && inputs.priorBugIds.length > 0) {
    lines.push("## Regression check");
    lines.push(
      `Bugs \`${inputs.priorBugIds.join(", ")}\` were flagged in the prior run and should now be fixed.`,
    );
    lines.push("Re-explore the flows that produced these findings and confirm they no longer reproduce.");
    lines.push("");
  }

  return lines.join("\n");
}
