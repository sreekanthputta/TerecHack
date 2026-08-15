import type { AgentContext } from "@autobiz/shared";

export type ResearcherEnv = {
  turnId: string;
  orchUrl: string;
  intUrl: string;
  fixtureMode: boolean;
  anthropicApiKey: string | undefined;
};

export function readEnv(ctx: AgentContext): ResearcherEnv {
  const fixtureMode =
    (process.env.FIXTURE_MODE ?? "").toLowerCase() === "true" || ctx.env.fixture_mode;
  return {
    turnId: process.env.TURN_ID ?? ctx.turn_id,
    orchUrl: process.env.ORCH_URL ?? ctx.env.orchestrator_url,
    intUrl: process.env.INT_URL ?? ctx.env.integrations_url,
    fixtureMode,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  };
}
