import type { DecisionRecord, TeracAsk, TeracRawResponse } from "@autobiz/shared";
import type { TriggerEvent } from "./trigger.js";

export function decisionMemoryPath(decisionId: string): string {
  return `decisions/${decisionId}.md`;
}

/**
 * Render the DecisionRecord as a memory markdown file. Structure:
 *   - YAML frontmatter (type/topic/terac_ask_id)
 *   - Before / After sections
 *   - Aggregate quote
 *   - Full raw Terac responses appended for the memory viewer
 */
export function renderDecisionMarkdown(input: {
  decision: DecisionRecord;
  ask: TeracAsk;
  raw: TeracRawResponse;
  trigger: TriggerEvent | undefined;
}): string {
  const { decision, ask, raw, trigger } = input;

  const frontmatter = [
    "---",
    "type: decision",
    `decision_id: ${decision.decision_id}`,
    `topic: ${yamlString(decision.topic)}`,
    `terac_ask_id: ${yamlString(decision.terac_ask_id ?? "")}`,
    `project_id: ${decision.project_id}`,
    `ts: ${decision.ts}`,
    "---",
    "",
  ].join("\n");

  const trigLine = trigger
    ? `Trigger: ${trigger.agent} · ${trigger.type} · confidence ${trigger.confidence ?? "?"}`
    : "Trigger: (none)";

  const body = [
    `# Decision · ${decision.topic}`,
    "",
    trigLine,
    "",
    `## Ask`,
    "",
    `> ${decision.aggregate}`,
    "",
    `**Question:** ${ask.question}`,
    `**Audience:** ${ask.audience}`,
    `**Why asking:** ${ask.why_asking}`,
    ask.options?.length ? `**Options:** ${ask.options.join(", ")}` : "",
    "",
    `## Before`,
    "",
    `- confidence: ${decision.before.confidence}`,
    `- value: ${codeInline(decision.before.value)}`,
    "",
    decision.before.reasoning,
    "",
    `## After`,
    "",
    `- confidence: ${decision.after.confidence}`,
    `- value: ${codeInline(decision.after.value)}`,
    "",
    decision.after.reasoning,
    "",
    `## Raw Terac responses (${raw.responses.length})`,
    "",
    ...raw.responses.map((r, i) => {
      const reason = r.reasoning ? ` — ${r.reasoning}` : "";
      const who = r.respondent_id ? ` \`${r.respondent_id}\`` : "";
      return `${i + 1}.${who} ${r.answer}${reason}`;
    }),
    "",
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  return frontmatter + body;
}

function yamlString(s: string): string {
  if (!s) return '""';
  return /[:\-#[\]{},&*!|>'"%@`]/.test(s) ? JSON.stringify(s) : s;
}

function codeInline(v: unknown): string {
  if (v === null || v === undefined) return "_none_";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `\`${s.length > 300 ? s.slice(0, 297) + "…" : s}\``;
}
