import { z } from "zod";
import { AgentNameSchema } from "./agents.js";

export const AgentTaskSchema = z.object({
  role: AgentNameSchema.exclude(["orchestrator"]),
  task: z.string().min(1),
  depends_on: z.array(z.string()).optional(),
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;

export const TeracStudyPlanSchema = z.object({
  topic: z.string().min(1),
  audience: z.string().min(1),
  when: z.enum(["before-build", "post-mvp", "on-uncertainty"]),
});

export type TeracStudyPlan = z.infer<typeof TeracStudyPlanSchema>;

export const BusinessPlanSchema = z.object({
  project_id: z.string().min(1),
  version: z.number().int().min(1),
  goal: z.string().min(1),
  vertical: z.string().min(1),
  agents: z.array(AgentTaskSchema),
  budget_usd: z.number().nonnegative(),
  terac_studies_planned: z.array(TeracStudyPlanSchema),
  owner_contact: z.object({
    channel: z.enum(["imessage", "email"]),
    address: z.string().min(1),
  }),
});

export type BusinessPlan = z.infer<typeof BusinessPlanSchema>;
