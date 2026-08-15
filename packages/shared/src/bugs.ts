import { z } from "zod";

export const BugSeveritySchema = z.enum(["blocker", "major", "minor"]);
export type BugSeverity = z.infer<typeof BugSeveritySchema>;

export const BugSchema = z.object({
  bug_id: z.string().length(8),
  severity: BugSeveritySchema,
  where: z.string().min(1),
  observed: z.string().min(1),
  expected: z.string().min(1),
  repro: z.array(z.string()),
});

export type Bug = z.infer<typeof BugSchema>;

export const BugReportSchema = z.object({
  project_id: z.string().min(1),
  run_id: z.string().min(1),
  builder_version: z.number().int().positive(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  bugs: z.array(BugSchema),
  ts: z.string().datetime(),
});

export type BugReport = z.infer<typeof BugReportSchema>;
