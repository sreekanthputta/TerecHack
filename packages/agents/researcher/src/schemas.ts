import { z } from "zod";

export const ResearchCandidateSchema = z.object({
  name: z.string().min(1),
  evidence: z.string().min(1),
  price_range: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  monthly_sales_est: z.number().int().nonnegative(),
});

export const ResearchPayloadSchema = z.object({
  candidates: z.array(ResearchCandidateSchema).min(1),
  top_pick: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type ResearchPayload = z.infer<typeof ResearchPayloadSchema>;
export type ResearchCandidate = z.infer<typeof ResearchCandidateSchema>;

export const ResearchSourceSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, digits, or dashes only"),
  title: z.string().min(1),
  url: z.string().url(),
  summary: z.string().min(1),
  evidence: z.string().min(1),
});

export const ResearchFixtureSchema = z.object({
  sources: z.array(ResearchSourceSchema).min(1),
  candidates: z.array(ResearchCandidateSchema).min(1),
  top_pick: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type ResearchFixture = z.infer<typeof ResearchFixtureSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
