import { z } from "zod";

export const TeracAskSchema = z.object({
  ask_id: z.string().optional(),
  project_id: z.string().min(1),
  question: z.string().min(1),
  audience: z.string().regex(/^(general|expert:.+)$/),
  options: z.array(z.string()).optional(),
  target_responses: z.number().int().positive(),
  why_asking: z.string().min(1),
});

export type TeracAsk = z.infer<typeof TeracAskSchema>;

export const TeracResponseItemSchema = z.object({
  answer: z.string(),
  reasoning: z.string().optional(),
  respondent_id: z.string().optional(),
});

export type TeracResponseItem = z.infer<typeof TeracResponseItemSchema>;

/**
 * RAW responses only. Aggregation is Verifier's job.
 */
export const TeracRawResponseSchema = z.object({
  ask_id: z.string().min(1),
  project_id: z.string().min(1),
  responses: z.array(TeracResponseItemSchema),
  received_at: z.string().datetime(),
});

export type TeracRawResponse = z.infer<typeof TeracRawResponseSchema>;
