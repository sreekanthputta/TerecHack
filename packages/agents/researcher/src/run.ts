import { AgentContextSchema } from "@autobiz/shared";
import { readEnv } from "./config.js";
import { baseFrom, makeEmitter, makeMemoryWriter } from "./orch.js";
import { readStdin } from "./stdin.js";

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const env = readEnv(ctx);
  const emit = makeEmitter(env.orchUrl, env.turnId, baseFrom(ctx));
  const writeMemory = makeMemoryWriter(env.orchUrl, env.turnId);

  await emit({
    type: "thought",
    content: `researcher received context for project ${ctx.project_id}, goal "${ctx.plan.goal}"`,
  });

  // TODO: real vs fixture flow lands in follow-up commits.
  void writeMemory;

  await emit({
    type: "result",
    content: `researcher stub — real flow lands next commit`,
    confidence: 0.5,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
