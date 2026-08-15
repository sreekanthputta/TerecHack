import { z } from "zod";

export const DecisionSideSchema = z.object({
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
});

export type DecisionSide = z.infer<typeof DecisionSideSchema>;

export const DecisionRecordSchema = z.object({
  project_id: z.string().min(1),
  decision_id: z.string().length(8),
  topic: z.string().min(1),
  before: DecisionSideSchema,
  after: DecisionSideSchema,
  aggregate: z.string().max(300),
  terac_ask_id: z.string().optional(),
  ts: z.string().datetime(),
});

export type DecisionRecord = z.infer<typeof DecisionRecordSchema>;
