import { TeracAskSchema, type AgentContext, type TeracAsk } from "@autobiz/shared";
import { askForJson } from "./claude.js";
import type { TriggerEvent } from "./trigger.js";

const ASK_SCHEMA_HINT = `{
  "question": "one crisp sentence, ends with '?'",
  "audience": "'general' or 'expert:<domain>'",
  "options": ["optional", "multiple-choice", "answers"],
  "why_asking": "one sentence — why the answer matters"
}`;

export type FormulateInput = {
  ctx: AgentContext;
  trigger: TriggerEvent | undefined;
  topic: string;
  targetResponses: number;
};

/**
 * Ask Claude for a TeracAsk based on the trigger event + memory listing.
 * Falls back to a deterministic ask if Claude is unavailable or malformed.
 */
export async function formulateAsk(input: FormulateInput): Promise<TeracAsk> {
  const { ctx, trigger, topic, targetResponses } = input;
  const audienceHint = topic ? `expert:${audienceForTopic(topic, ctx.plan.vertical)}` : "general";

  const prompt = [
    `Project goal: ${ctx.plan.goal}`,
    `Vertical: ${ctx.plan.vertical}`,
    trigger
      ? `A ${trigger.agent} agent emitted a ${trigger.type} with confidence ${trigger.confidence ?? "unknown"}:\n"${trigger.content}"`
      : `No explicit trigger event. Verify a planned study topic: ${topic}`,
    `Memory files (project): ${ctx.memory.project.slice(0, 6).join(", ") || "(none)"}`,
    `You are formulating a Terac panel question to reduce that uncertainty.`,
    `Audience preference: ${audienceHint}. Keep the question quotable and unambiguous.`,
  ].join("\n\n");

  const raw = await askForJson(prompt, ASK_SCHEMA_HINT);
  const fromClaude = raw ? safeParseAsk(raw, ctx.project_id, targetResponses) : undefined;
  if (fromClaude) return fromClaude;

  return fallbackAsk(ctx, trigger, topic, targetResponses, audienceHint);
}

function safeParseAsk(raw: string, projectId: string, target: number): TeracAsk | undefined {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const candidate: TeracAsk = {
      project_id: projectId,
      question: String(obj.question ?? "").trim(),
      audience: String(obj.audience ?? "general"),
      options: Array.isArray(obj.options) ? obj.options.map(String) : undefined,
      target_responses: target,
      why_asking: String(obj.why_asking ?? "reduce uncertainty on a low-confidence decision"),
    };
    return TeracAskSchema.parse(candidate);
  } catch {
    return undefined;
  }
}

function fallbackAsk(
  ctx: AgentContext,
  trigger: TriggerEvent | undefined,
  topic: string,
  target: number,
  audience: string,
): TeracAsk {
  const focus = trigger?.content?.slice(0, 160) || topic || ctx.plan.vertical;
  return TeracAskSchema.parse({
    project_id: ctx.project_id,
    question: `Would you pay for ${focus}?`,
    audience,
    target_responses: target,
    why_asking: `Verify a low-confidence claim about ${topic} before we commit budget.`,
  });
}

function audienceForTopic(topic: string, vertical: string): string {
  const t = topic.toLowerCase();
  if (t.includes("niche") || t.includes("customer")) return "makers";
  if (t.includes("price") || t.includes("pricing")) return "buyers";
  if (t.includes("vendor")) return "operators";
  return vertical.replace(/\s+/g, "-").toLowerCase() || "makers";
}
