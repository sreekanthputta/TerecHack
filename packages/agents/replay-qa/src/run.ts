import { randomUUID } from "node:crypto";
import { AgentContextSchema, type AgentContext, type Bug } from "@autobiz/shared";
import { readInputs, type ReplayInputs } from "./context.js";
import { buildDesignDocument } from "./design-doc.js";
import {
  createFixtureClient,
  createHttpClient,
  type LoopQaClient,
  type LoopQaProject,
  type LoopQaStatus,
} from "./loop-qa.js";
import { buildBugReport, mapBug, summariseStatus, type MappedBug } from "./bugs.js";
import { loopQaProjectMemo, runBugsMemo, runReportMemo } from "./memory.js";
import { OrchestratorClient } from "./orchestrator.js";

const AGENT = "replay-qa" as const;
const POLL_STATUS_EMIT_EVERY = 2;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function newRunId(): string {
  return `rqa-${randomUUID().slice(0, 8)}`;
}

async function loadPriorProjectId(ctx: AgentContext): Promise<string | undefined> {
  try {
    const url = `${ctx.env.orchestrator_url}/internal/turns/${ctx.turn_id}/memory?path=${encodeURIComponent(
      "replay/loop-qa-project.md",
    )}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { body?: string };
    const match = body.body?.match(/loop_qa_project_id:\s*`([^`]+)`/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

async function acquireProject(
  orch: OrchestratorClient,
  loopQa: LoopQaClient,
  ctx: AgentContext,
  inputs: ReplayInputs,
  designDocument: string,
): Promise<LoopQaProject> {
  const priorProjectId = inputs.runNumber > 1 ? await loadPriorProjectId(ctx) : undefined;
  if (priorProjectId) {
    const { exploration_id } = await loopQa.startExploration(priorProjectId);
    return {
      id: priorProjectId,
      dashboard_url: `https://qa.replay.io/projects/${priorProjectId}`,
      exploration_id,
    };
  }
  if (inputs.runNumber > 1) {
    // Fixture path: we know the project id lives in the fixture; skip create and start a fresh exploration.
    const project = await loopQa.createProject({
      name: `autobiz-${ctx.project_id}`,
      base_url: inputs.landingUrl,
      design_document: designDocument,
    });
    const { exploration_id } = await loopQa.startExploration(project.id);
    return { ...project, exploration_id };
  }
  return loopQa.createProject({
    name: `autobiz-${ctx.project_id}`,
    base_url: inputs.landingUrl,
    design_document: designDocument,
  });
}

async function drainStatus(
  orch: OrchestratorClient,
  loopQa: LoopQaClient,
  project: LoopQaProject,
): Promise<LoopQaStatus> {
  let final: LoopQaStatus | undefined;
  let i = 0;
  for await (const status of loopQa.pollStatus(project.id)) {
    if (i % POLL_STATUS_EMIT_EVERY === 0) {
      await orch.event("thought", summariseStatus(status), {
        metadata: { dashboard_url: project.dashboard_url, done: status.done },
      });
    }
    final = status;
    if (status.done) break;
    i++;
  }
  if (!final) throw new Error("loop-qa produced no status");
  return final;
}

async function fetchMappedBugs(loopQa: LoopQaClient, project: LoopQaProject): Promise<MappedBug[]> {
  const refs = await loopQa.listBugs(project.id);
  const mapped: MappedBug[] = [];
  for (const ref of refs) {
    const detail = await loopQa.getBugDetail(ref.loop_qa_bug_id);
    mapped.push(mapBug(detail));
  }
  return mapped;
}

async function writeMemories(
  orch: OrchestratorClient,
  runNumber: number,
  project: LoopQaProject,
  status: LoopQaStatus,
  mapped: MappedBug[],
  builderVersion: number,
): Promise<void> {
  await orch.memory("replay/loop-qa-project.md", loopQaProjectMemo(project, runNumber));
  await orch.memory(`replay/run-${runNumber}-bugs.md`, runBugsMemo(runNumber, mapped));
  await orch.memory(
    `replay/run-${runNumber}-report.md`,
    runReportMemo({
      runNumber,
      dashboardUrl: project.dashboard_url,
      status,
      mapped,
      builderVersion,
    }),
  );
}

async function runOnce(ctx: AgentContext): Promise<void> {
  const inputs = await readInputs(ctx);
  const orch = new OrchestratorClient(ctx.env.orchestrator_url, ctx.turn_id, {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  });

  await orch.event(
    "thought",
    `Replay QA run ${inputs.runNumber} against ${inputs.landingUrl} (builder v${inputs.builderVersion})`,
  );

  const designDocument = buildDesignDocument(ctx, inputs);
  const loopQa = ctx.env.fixture_mode
    ? createFixtureClient(inputs.runNumber)
    : createHttpClient(`${ctx.env.integrations_url}`);

  let project: LoopQaProject;
  try {
    project = await acquireProject(orch, loopQa, ctx, inputs, designDocument);
  } catch (err) {
    await orch.event("error", `Loop QA project create failed: ${(err as Error).message}`);
    return;
  }

  await orch.event(
    "action",
    `Opened Loop QA exploration ${project.exploration_id}`,
    { metadata: { dashboard_url: project.dashboard_url, loop_qa_project_id: project.id } },
  );

  let status: LoopQaStatus;
  try {
    status = await drainStatus(orch, loopQa, project);
  } catch (err) {
    await orch.event("error", `Loop QA polling failed: ${(err as Error).message}`, {
      metadata: { dashboard_url: project.dashboard_url, recovery: "Builder does not respawn." },
    });
    return;
  }

  let mapped: MappedBug[];
  try {
    mapped = await fetchMappedBugs(loopQa, project);
  } catch (err) {
    await orch.event("error", `Loop QA bug fetch failed: ${(err as Error).message}`);
    return;
  }

  const bugs: Bug[] = mapped.map((m) => m.bug);
  const runId = newRunId();
  const report = buildBugReport({
    projectId: ctx.project_id,
    runId,
    builderVersion: inputs.builderVersion,
    passed: status.journeys_passed_count,
    bugs,
  });
  await orch.bugs(report);

  await orch.event(
    "bugs_found",
    `Loop QA: ${report.passed} passed, ${report.failed} failed`,
    {
      metadata: {
        dashboard_url: project.dashboard_url,
        loop_qa_project_id: project.id,
        passed: report.passed,
        failed: report.failed,
        bug_ids: bugs.map((b) => b.bug_id),
        evidence_urls: mapped.map((m) => m.evidence_url),
      },
    },
  );

  await writeMemories(orch, inputs.runNumber, project, status, mapped, inputs.builderVersion);

  if (report.failed === 0) {
    await orch.state({ status: "live", bugs_open: 0 });
    await orch.event("result", `Replay QA green. Site flipped to live.`, {
      metadata: { dashboard_url: project.dashboard_url },
    });
    return;
  }

  await orch.event(
    "result",
    `Replay QA found ${report.failed} bug(s). Handing back to Builder v${inputs.builderVersion + 1}.`,
    {
      metadata: {
        dashboard_url: project.dashboard_url,
        bug_ids: bugs.map((b) => b.bug_id),
      },
    },
  );
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  await runOnce(ctx);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
