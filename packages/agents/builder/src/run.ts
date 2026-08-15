import { AgentContextSchema, type AgentContext } from "@autobiz/shared";
import { OrchClient } from "./orch.js";
import { pickTemplate } from "./template.js";

const AGENT = "builder" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function detectVersion(ctx: AgentContext): { version: number; isRetry: boolean } {
  const bugs = ctx.prior_bugs ?? [];
  return { version: bugs.length > 0 ? 2 : 1, isRetry: bugs.length > 0 };
}

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const orch = new OrchClient(ctx.env.orchestrator_url, ctx.turn_id, {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  });

  const { version, isRetry } = detectVersion(ctx);

  await orch.event({
    type: "thought",
    content: isRetry
      ? `builder v${version}: retry run with ${ctx.prior_bugs!.length} prior bug(s)`
      : `builder v${version}: fresh build for ${ctx.plan.vertical} project`,
  });

  const template = pickTemplate(ctx.plan);
  await orch.event({
    type: "action",
    content: `chose template "${template.id}" (${template.reason})`,
    metadata: { template: template.id, sku_count: template.sku_count },
  });

  await orch.event({
    type: "result",
    content: `builder v${version} finished; template=${template.id}`,
    metadata: { template: template.id, sku_count: template.sku_count },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
