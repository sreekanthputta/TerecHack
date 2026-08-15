import { AgentContextSchema } from "@autobiz/shared";
import { readEnv } from "./config.js";
import { runFixtureFlow } from "./fixture.js";
import { LLM } from "./llm.js";
import { baseFrom, makeEmitter, makeMemoryWriter } from "./orch.js";
import { runRealFlow } from "./real.js";
import { readStdin } from "./stdin.js";
import { Superserve } from "./superserve.js";

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

  if (!env.anthropicApiKey) {
    await emit({
      type: "error",
      content: `researcher: ANTHROPIC_API_KEY not set — cannot run real mode`,
    });
    process.exit(1);
  }

  const browser = new Superserve(env.intUrl);
  const llm = new LLM(env.anthropicApiKey);
  try {
    await runRealFlow({ ctx, emit, writeMemory, llm, browser });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
