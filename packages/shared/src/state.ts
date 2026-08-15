import { z } from "zod";

export const ProjectStatusSchema = z.enum([
  "planning",
  "researching",
  "building",
  "qa",
  "live",
  "pivoting",
  "error",
]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

export const BusinessStateSchema = z.object({
  project_id: z.string().min(1),
  goal: z.string().min(1),
  status: ProjectStatusSchema,
  plan_version: z.number().int().min(1),
  landing_url: z.string().url().optional(),
  stripe_payment_link: z.string().url().optional(),
  stripe_balance_usd: z.number(),
  charges_count: z.number().int().nonnegative(),
  uptime_pct: z.number().min(0).max(100),
  p95_latency_ms: z.number().int().nonnegative(),
  errors_last_5m: z.number().int().nonnegative(),
  builder_version: z.number().int().nonnegative(),
  decisions_count: z.number().int().nonnegative(),
  bugs_open: z.number().int().nonnegative(),
  started_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type BusinessState = z.infer<typeof BusinessStateSchema>;

/**
 * Agents post partial updates; orchestrator merges.
 */
export const BusinessStatePatchSchema = BusinessStateSchema.partial().omit({
  project_id: true,
  goal: true,
  started_at: true,
});
export type BusinessStatePatch = z.infer<typeof BusinessStatePatchSchema>;
