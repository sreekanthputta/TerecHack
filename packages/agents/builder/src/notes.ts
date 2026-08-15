import type { Bug } from "@autobiz/shared";
import type { LandingCopy } from "./content.js";
import type { PaymentLink, DeployResult } from "./integrations.js";
import type { TemplateId } from "./template.js";

export function buildNotes(opts: {
  version: number;
  template: TemplateId;
  copy: LandingCopy;
  paymentLink: PaymentLink;
  deployRes: DeployResult;
  priorBugs?: Bug[];
  fixedBugIds?: string[];
}): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: Builder v${opts.version} notes`);
  lines.push(`version: ${opts.version}`);
  lines.push(`template: ${opts.template}`);
  lines.push(`landing_url: ${opts.deployRes.url}`);
  lines.push(`payment_link: ${opts.paymentLink.url}`);
  lines.push(`deploy_id: ${opts.deployRes.deploy_id}`);
  lines.push(`ts: ${new Date().toISOString()}`);
  lines.push("---");
  lines.push("");
  lines.push(`# Build v${opts.version} — ${opts.copy.brand_name}`);
  lines.push("");
  lines.push(`Hero: **${opts.copy.hero}**`);
  lines.push("");
  lines.push(opts.copy.subheadline);
  lines.push("");
  lines.push("## Products");
  for (const p of opts.copy.products) {
    lines.push(`- **${p.name}** — $${p.price_usd} — ${p.blurb}`);
  }
  lines.push("");
  lines.push("## Decisions");
  lines.push(`- Template: ${opts.template}`);
  lines.push(`- Stripe: ${opts.paymentLink.id}`);
  lines.push(`- Render deploy id: ${opts.deployRes.deploy_id}`);

  if (opts.priorBugs && opts.priorBugs.length > 0) {
    lines.push("");
    lines.push("## Prior bugs addressed");
    for (const bug of opts.priorBugs) {
      const fixed = opts.fixedBugIds?.includes(bug.bug_id) ? "✅ fixed" : "attempted";
      lines.push(`- \`${bug.bug_id}\` (${bug.severity}) at ${bug.where} — ${fixed}: ${bug.observed}`);
    }
  }
  return lines.join("\n") + "\n";
}
