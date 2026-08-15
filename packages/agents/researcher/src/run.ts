import { AgentContextSchema } from "@autobiz/shared";
import { readEnv } from "./config.js";
import { runFixtureFlow } from "./fixture.js";
import { baseFrom, makeEmitter, makeMemoryWriter } from "./orch.js";
import { readStdin } from "./stdin.js";

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const env = readEnv(ctx);
  const emit = makeEmitter(env.orchUrl, env.turnId, baseFrom(ctx));
  const writeMemory = makeMemoryWriter(env.orchUrl, env.turnId);

  if (env.fixtureMode) {
    await runFixtureFlow(ctx, emit, writeMemory);
    return;
  }

  // Real flow is added in the next commits (LLM plan-of-inquiry + Superserve).
  await emit({
    type: "thought",
    content: `researcher received context for project ${ctx.project_id}, goal "${ctx.plan.goal}"`,
  });
  await emit({
    type: "result",
    content: `researcher: real-mode flow not yet implemented in this build`,
    confidence: 0.4,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
