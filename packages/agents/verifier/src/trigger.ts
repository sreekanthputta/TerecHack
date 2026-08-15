import { z } from "zod";
import type { AgentContext, DecisionSide } from "@autobiz/shared";

/**
 * The trigger event that spawned this verifier. In production this is inserted
 * by the orchestrator as `metadata.trigger_event` on the raw context JSON.
 * Because the shared `AgentContext` schema does not (yet) declare a `metadata`
 * field, we lift it out of the raw JSON *before* zod-validating the context.
 */
export const TriggerEventSchema = z.object({
  type: z.string().min(1),
  agent: z.string().min(1),
  content: z.string().default(""),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TriggerEvent = z.infer<typeof TriggerEventSchema>;

export function extractTriggerEvent(rawJson: unknown): TriggerEvent | undefined {
  if (!rawJson || typeof rawJson !== "object") return undefined;
  const md = (rawJson as Record<string, unknown>).metadata;
  if (md && typeof md === "object") {
    const te = (md as Record<string, unknown>).trigger_event;
    const parsed = TriggerEventSchema.safeParse(te);
    if (parsed.success) return parsed.data;
  }
  // Fallback: agents built in parallel may not yet inject metadata. Some
  // contract fixtures encode the trigger as a message with a `TRIGGER_EVENT:`
  // prefix followed by JSON.
  const messages = (rawJson as Record<string, unknown>).messages;
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (typeof m !== "string" || !m.startsWith("TRIGGER_EVENT:")) continue;
      try {
        const parsed = TriggerEventSchema.safeParse(JSON.parse(m.slice("TRIGGER_EVENT:".length)));
        if (parsed.success) return parsed.data;
      } catch {
        // ignore
      }
    }
  }
  return undefined;
}

/**
 * The `before` side of a DecisionRecord — derived from the trigger event.
 * Missing confidence is treated as 0.5 (uncertain) so verifier still runs.
 */
export function beforeFromTrigger(trigger: TriggerEvent | undefined, ctx: AgentContext): DecisionSide {
  if (!trigger) {
    return {
      value: null,
      confidence: 0.5,
      reasoning: `No explicit trigger event. Verifying default plan topic for project ${ctx.project_id}.`,
    };
  }
  const md = trigger.metadata ?? {};
  const value = "value" in md ? md.value : trigger.content;
  return {
    value: value ?? trigger.content,
    confidence: trigger.confidence ?? 0.5,
    reasoning: trigger.content || `Low-confidence ${trigger.type} from ${trigger.agent}`,
  };
}

export function topicFromTrigger(trigger: TriggerEvent | undefined, fallback: string): string {
  const md = trigger?.metadata ?? {};
  const t = typeof md.topic === "string" ? md.topic : undefined;
  return t ?? fallback;
}
