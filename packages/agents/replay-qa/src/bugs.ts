import { createHash } from "node:crypto";
import type { Bug, BugReport, BugSeverity } from "@autobiz/shared";
import type { LoopQaBugRef, LoopQaStatus } from "./loop-qa.js";

export type MappedBug = {
  bug: Bug;
  loop_qa_bug_id: string;
  evidence_url: string;
};

/**
 * Deterministic 8-char id derived from the Loop QA bug id so re-runs stay stable.
 */
export function shortId(loopQaBugId: string): string {
  return createHash("sha1").update(loopQaBugId).digest("hex").slice(0, 8);
}

function mapSeverity(sev: string): BugSeverity {
  if (sev === "blocker" || sev === "major" || sev === "minor") return sev;
  return "major";
}

export function mapBug(ref: LoopQaBugRef): MappedBug {
  const where = ref.route || ref.component;
  const bug: Bug = {
    bug_id: shortId(ref.loop_qa_bug_id),
    severity: mapSeverity(ref.severity),
    where,
    observed: ref.finding_summary,
    expected: ref.expected_behavior,
    repro: ref.repro_steps,
  };
  return { bug, loop_qa_bug_id: ref.loop_qa_bug_id, evidence_url: ref.evidence_url };
}

export function buildBugReport(input: {
  projectId: string;
  runId: string;
  builderVersion: number;
  passed: number;
  bugs: Bug[];
  ts?: string;
}): BugReport {
  return {
    project_id: input.projectId,
    run_id: input.runId,
    builder_version: input.builderVersion,
    passed: input.passed,
    failed: input.bugs.length,
    bugs: input.bugs,
    ts: input.ts ?? new Date().toISOString(),
  };
}

export function summariseStatus(status: LoopQaStatus): string {
  return `Loop QA exploring · ${status.journeys_covered} test-journeys covered so far`;
}
