import type { LoopQaProject, LoopQaStatus } from "./loop-qa.js";
import type { MappedBug } from "./bugs.js";

export function loopQaProjectMemo(project: LoopQaProject, runNumber: number): string {
  return [
    `# Loop QA project`,
    ``,
    `- loop_qa_project_id: \`${project.id}\``,
    `- dashboard_url: ${project.dashboard_url}`,
    `- last_run: ${runNumber}`,
    `- last_exploration_id: \`${project.exploration_id}\``,
    ``,
    `Reuse this project id for any subsequent builder version — do NOT create a new Loop QA project.`,
    ``,
  ].join("\n");
}

export function runBugsMemo(runNumber: number, mapped: MappedBug[]): string {
  const lines: string[] = [];
  lines.push(`# Replay QA run ${runNumber} — bugs`);
  lines.push("");
  if (mapped.length === 0) {
    lines.push("No bugs found. All journeys passed.");
    lines.push("");
    return lines.join("\n");
  }
  for (const { bug, evidence_url, loop_qa_bug_id } of mapped) {
    lines.push(`## ${bug.bug_id} · ${bug.severity} · ${bug.where}`);
    lines.push("");
    lines.push(`- **Loop QA id:** \`${loop_qa_bug_id}\``);
    lines.push(`- **Evidence:** ${evidence_url}`);
    lines.push(`- **Observed:** ${bug.observed}`);
    lines.push(`- **Expected:** ${bug.expected}`);
    lines.push(`- **Repro:**`);
    for (const step of bug.repro) lines.push(`  1. ${step}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function runReportMemo(input: {
  runNumber: number;
  dashboardUrl: string;
  status: LoopQaStatus;
  mapped: MappedBug[];
  builderVersion: number;
}): string {
  const { runNumber, dashboardUrl, status, mapped, builderVersion } = input;
  const lines: string[] = [];
  lines.push(`# Replay QA run ${runNumber} — report`);
  lines.push("");
  lines.push(`**Loop QA dashboard:** ${dashboardUrl}`);
  lines.push("");
  lines.push(`- Builder version: v${builderVersion}`);
  lines.push(`- Journeys covered: ${status.journeys_covered}`);
  lines.push(`- Journeys passed: ${status.journeys_passed_count}`);
  lines.push(`- Journeys failed: ${status.journeys_failed_count}`);
  lines.push(`- Bugs surfaced: ${mapped.length}`);
  lines.push("");
  if (mapped.length === 0) {
    lines.push(`Result: **GREEN** — status flipped to \`live\`.`);
  } else {
    lines.push(`Result: **BUGS** — handed off to Builder for v${builderVersion + 1}.`);
    lines.push("");
    lines.push("| Bug | Severity | Where | Loop QA |");
    lines.push("| --- | --- | --- | --- |");
    for (const { bug, loop_qa_bug_id, evidence_url } of mapped) {
      lines.push(
        `| \`${bug.bug_id}\` | ${bug.severity} | ${bug.where} | [${loop_qa_bug_id}](${evidence_url}) |`,
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}
