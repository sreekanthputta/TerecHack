import { z } from "zod";

export const AgentNameSchema = z.enum([
  "planner",
  "researcher",
  "builder",
  "verifier",
  "replay-qa",
  "revenue-watcher",
  "service-watcher",
  "orchestrator",
]);

export type AgentName = z.infer<typeof AgentNameSchema>;
