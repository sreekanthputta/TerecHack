import { AgentContextSchema, type TraceEventInput } from "@autobiz/shared";
import { OrchClient } from "./http.js";
import { loadState, pruneSynthHashes, recentTicks, saveState } from "./state.js";

const AGENT = "service-watcher" as const;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const orch = new OrchClient(ctx.env.orchestrator_url, ctx.turn_id);
  const nowIso = () => new Date().toISOString();

  const base = {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  } as const;

  const emit = (partial: Omit<TraceEventInput, keyof typeof base>) =>
    orch.postEvent({ ...base, ...partial });

  let state = loadState(ctx.project_id);
  state = pruneSynthHashes(state, Date.now());

  await emit({
    type: "thought",
    content: `service-watcher tick t=${ctx.turn} project=${ctx.project_id} history=${recentTicks(state).length}`,
    ts: nowIso(),
  });

  saveState(state);

  await emit({
    type: "result",
    content: `service-watcher tick t=${ctx.turn} complete`,
    ts: nowIso(),
  });
}

main().catch((err) => {
  console.error(err);
  // Fail-soft: never crash cron. Non-zero exit only if we cannot serialize even
  // an error trace.
  process.exit(0);
});
