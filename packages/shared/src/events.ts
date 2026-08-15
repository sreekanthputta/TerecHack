import { z } from "zod";
import { AgentNameSchema } from "./agents.js";

export const TraceEventTypeSchema = z.enum([
  "thought",
  "action",
  "terac_call",
  "terac_result",
  "decision",
  "plan_update",
  "deploy",
  "bugs_found",
  "bugs_fixed",
  "health_check",
  "log_signal",
  "sale",
  "pivot_absorbed",
  "result",
  "error",
]);

export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;

export const TraceEventSchema = z.object({
  id: z.number().int().nonnegative(),
  project_id: z.string().min(1),
  turn: z.number().int().nonnegative(),
  agent: AgentNameSchema,
  agent_run_id: z.string().min(1),
  type: TraceEventTypeSchema,
  content: z.string().max(500),
  ts: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type TraceEvent = z.infer<typeof TraceEventSchema>;

/**
 * Client-side shape: `id` is assigned by the orchestrator on insert, so agents
 * post events without an id.
 */
export const TraceEventInputSchema = TraceEventSchema.omit({ id: true });
export type TraceEventInput = z.infer<typeof TraceEventInputSchema>;
