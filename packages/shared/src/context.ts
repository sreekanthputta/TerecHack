import { z } from "zod";
import { AgentNameSchema } from "./agents.js";
import { BugSchema } from "./bugs.js";
import { BusinessPlanSchema } from "./plan.js";
import { PluginConfigSchema } from "./plugins.js";

/**
 * What the orchestrator hands to a spawned agent on stdin as a single JSON line.
 * Also returned by GET /internal/turns/:turn_id/context.
 */
export const AgentContextSchema = z.object({
  turn_id: z.string().min(1),
  project_id: z.string().min(1),
  turn: z.number().int().nonnegative(),
  agent: AgentNameSchema.exclude(["orchestrator"]),
  agent_run_id: z.string().min(1),
  plan: BusinessPlanSchema,
  prior_bugs: z.array(BugSchema).optional(),
  messages: z.array(z.string()),
  memory: z.object({
    workspace: z.array(z.string()),
    project: z.array(z.string()),
  }),
  plugin_configs: z.array(PluginConfigSchema),
  env: z.object({
    integrations_url: z.string().url(),
    orchestrator_url: z.string().url(),
    fixture_mode: z.boolean(),
  }),
});

export type AgentContext = z.infer<typeof AgentContextSchema>;
