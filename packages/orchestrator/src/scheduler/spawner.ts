import { spawn as nodeSpawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { AgentContext, AgentName, BusinessPlan, PluginConfig, Bug } from "@autobiz/shared";
import type { Ctx } from "../app.js";
import { listMemoryPathsForContext } from "../memory/fs.js";
import { runFixtureScript } from "../fixtures/scripts.js";

/**
 * Spawns agents. In FIXTURE_MODE the spawner never touches child_process —
 * it replays canned events from fixtures/traces/*.jsonl through the same
 * event-insert path, so the rest of the pipeline is oblivious.
 */

export type SpawnedTurn = {
  turn_id: string;
  agent: AgentName;
  agent_run_id: string;
  child?: ChildProcess;
  onDone: Promise<"done" | "error">;
};

export type SpawnExtras = {
  prior_bugs?: Bug[];
  messages?: string[];
};

const AGENT_ENTRIES = new Map<AgentName, string>([
  ["planner", "packages/agents/planner/dist/run.js"],
  ["researcher", "packages/agents/researcher/dist/run.js"],
  ["builder", "packages/agents/builder/dist/run.js"],
  ["verifier", "packages/agents/verifier/dist/run.js"],
  ["replay-qa", "packages/agents/replay-qa/dist/run.js"],
  ["revenue-watcher", "packages/agents/revenue-watcher/dist/run.js"],
  ["service-watcher", "packages/agents/service-watcher/dist/run.js"],
]);

export class Spawner {
  private pids = new Map<string, ChildProcess>();
  private repoRoot: string;

  constructor(
    private readonly ctx: Ctx,
    private readonly logger: Logger,
    repoRoot?: string,
  ) {
    this.repoRoot = repoRoot ?? findRepoRoot();
  }

  /** Kill all tracked children. Sends SIGTERM then SIGKILL after 5s. */
  async killAll(): Promise<void> {
    const children = Array.from(this.pids.values());
    if (children.length === 0) return;
    for (const c of children) {
      try { c.kill("SIGTERM"); } catch { /* ignore */ }
    }
    await new Promise((r) => setTimeout(r, 5000));
    for (const c of children) {
      if (!c.killed) {
        try { c.kill("SIGKILL"); } catch { /* ignore */ }
      }
    }
    this.pids.clear();
  }

  buildContext(input: {
    turn_id: string;
    project_id: string;
    turn: number;
    agent: Exclude<AgentName, "orchestrator">;
    agent_run_id: string;
    plan: BusinessPlan;
    extras: SpawnExtras;
    pluginConfigs: PluginConfig[];
  }): AgentContext {
    const memory = listMemoryPathsForContext(input.project_id);
    return {
      turn_id: input.turn_id,
      project_id: input.project_id,
      turn: input.turn,
      agent: input.agent,
      agent_run_id: input.agent_run_id,
      plan: input.plan,
      messages: input.extras.messages ?? [],
      memory,
      plugin_configs: input.pluginConfigs,
      env: {
        integrations_url: this.ctx.env.integrations_url,
        orchestrator_url: this.ctx.env.orchestrator_url,
        fixture_mode: this.ctx.env.fixture_mode,
      },
      ...(input.extras.prior_bugs && input.extras.prior_bugs.length > 0
        ? { prior_bugs: input.extras.prior_bugs }
        : {}),
    };
  }

  spawn(input: {
    project_id: string;
    agent: Exclude<AgentName, "orchestrator">;
    turn: number;
    plan: BusinessPlan;
    extras?: SpawnExtras;
    pluginConfigs: PluginConfig[];
  }): SpawnedTurn {
    const turn_id = randomUUID();
    const agent_run_id = randomUUID();

    this.ctx.repo.createTurn({
      turn_id,
      project_id: input.project_id,
      turn: input.turn,
      agent: input.agent,
      agent_run_id,
    });

    const context = this.buildContext({
      turn_id,
      project_id: input.project_id,
      turn: input.turn,
      agent: input.agent,
      agent_run_id,
      plan: input.plan,
      extras: input.extras ?? {},
      pluginConfigs: input.pluginConfigs,
    });

    if (this.ctx.env.fixture_mode) {
      const onDone = this.runFixture({
        project_id: input.project_id,
        agent: input.agent,
        turn: input.turn,
        agent_run_id,
        turn_id,
        prior_bugs: input.extras?.prior_bugs ?? [],
        messages: input.extras?.messages ?? [],
      });
      return { turn_id, agent: input.agent, agent_run_id, onDone };
    }

    const entryRel = AGENT_ENTRIES.get(input.agent);
    if (!entryRel) {
      this.logger.error({ agent: input.agent }, "unknown agent entrypoint");
      this.ctx.repo.endTurn(turn_id, "error");
      return { turn_id, agent: input.agent, agent_run_id, onDone: Promise.resolve("error") };
    }
    const entry = resolve(this.repoRoot, entryRel);
    if (!existsSync(entry)) {
      this.logger.warn({ entry }, "agent entrypoint not built; marking turn errored");
      this.ctx.repo.endTurn(turn_id, "error");
      return { turn_id, agent: input.agent, agent_run_id, onDone: Promise.resolve("error") };
    }

    const logDir = join(this.repoRoot, "logs", input.project_id);
    mkdirSync(logDir, { recursive: true });
    const logPath = join(logDir, `${input.turn}-${input.agent}.log`);
    const logStream = createWriteStream(logPath, { flags: "a" });

    const child = nodeSpawn(process.execPath, [entry], {
      cwd: this.repoRoot,
      env: {
        ...process.env,
        TURN_ID: turn_id,
        ORCH_URL: this.ctx.env.orchestrator_url,
        INT_URL: this.ctx.env.integrations_url,
        FIXTURE_MODE: String(this.ctx.env.fixture_mode),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);
    child.stdin?.write(JSON.stringify(context) + "\n");
    child.stdin?.end();

    this.pids.set(turn_id, child);

    const onDone = new Promise<"done" | "error">((resolveDone) => {
      const finalize = (status: "done" | "error") => {
        this.pids.delete(turn_id);
        this.ctx.repo.endTurn(turn_id, status);
        logStream.end();
        resolveDone(status);
      };
      child.on("error", (err) => {
        this.logger.error({ err: String(err), agent: input.agent }, "agent spawn error");
        finalize("error");
      });
      child.on("exit", (code) => {
        finalize(code === 0 ? "done" : "error");
      });
    });

    return { turn_id, agent: input.agent, agent_run_id, child, onDone };
  }

  /**
   * Fixture mode: run in-process scripted stubs. Since the worktree cannot write
   * to fixtures/agents/, we embed per-agent scripts in src/fixtures/scripts.ts.
   */
  private async runFixture(input: {
    project_id: string;
    agent: AgentName;
    turn: number;
    agent_run_id: string;
    turn_id: string;
    prior_bugs: Bug[];
    messages: string[];
  }): Promise<"done" | "error"> {
    try {
      await runFixtureScript(this.ctx, input);
      this.ctx.repo.endTurn(input.turn_id, "done");
      return "done";
    } catch (err) {
      this.logger.error({ err: String(err), agent: input.agent }, "fixture script failed");
      this.ctx.repo.endTurn(input.turn_id, "error");
      return "error";
    }
  }
}

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

