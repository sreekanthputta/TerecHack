import { AgentContextSchema, type TraceEventInput } from "@autobiz/shared";

const AGENT = "verifier" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function postEvent(orchUrl: string, turnId: string, event: TraceEventInput) {
  const res = await fetch(`${orchUrl}/internal/turns/${turnId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`POST event failed: ${res.status}`);
}

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const orchUrl = ctx.env.orchestrator_url;
  const nowIso = () => new Date().toISOString();

  const base = {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  } as const;

  await postEvent(orchUrl, ctx.turn_id, {
    ...base,
    type: "thought",
    content: `[stub] ${AGENT} received context for project ${ctx.project_id}`,
    ts: nowIso(),
  });

  await postEvent(orchUrl, ctx.turn_id, {
    ...base,
    type: "result",
    content: `[stub] ${AGENT} finished. Real implementation lives in this worktree's PRD.`,
    ts: nowIso(),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
