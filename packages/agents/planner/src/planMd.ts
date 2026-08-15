import type { BusinessPlan } from "@autobiz/shared";

export function renderPlanMd(plan: BusinessPlan, opts: { agent_run_id: string; turn: number }): string {
  const ts = new Date().toISOString();
  const frontmatter = [
    "---",
    "type: plan",
    `project_id: ${plan.project_id}`,
    "agent: planner",
    `turn: ${opts.turn}`,
    `ts: ${ts}`,
    `version: ${plan.version}`,
    "---",
    "",
  ].join("\n");

  const agents = plan.agents
    .map((a) => `- **${a.role}** — ${a.task}${a.depends_on?.length ? ` _(after: ${a.depends_on.join(", ")})_` : ""}`)
    .join("\n");
  const studies = plan.terac_studies_planned
    .map((s) => `- ${s.topic} (${s.audience}, ${s.when})`)
    .join("\n");

  const body = [
    `# Plan v${plan.version} — ${plan.vertical}`,
    "",
    `**Goal:** ${plan.goal}`,
    "",
    `**Budget:** $${plan.budget_usd}`,
    "",
    `**Owner contact:** ${plan.owner_contact.channel} — ${plan.owner_contact.address}`,
    "",
    "## Agents",
    agents || "_none_",
    "",
    "## Terac studies planned",
    studies || "_none_",
    "",
  ].join("\n");

  return frontmatter + body;
}
