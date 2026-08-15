import type { Logger } from "pino";
import type { Ctx } from "../app.js";
import type { Spawner } from "./spawner.js";
import { listPluginConfigs } from "../plugins/service.js";

/**
 * Cron ticks for watcher agents. Only fires while the project is `live`.
 * Each tick is a fresh turn with a fresh turn_id.
 */
type CronConfig = {
  agent: "revenue-watcher" | "service-watcher";
  intervalMs: number;
};

const AGENTS: CronConfig[] = [
  { agent: "revenue-watcher", intervalMs: 30_000 },
  { agent: "service-watcher", intervalMs: 60_000 },
];

export class CronLoop {
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly ctx: Ctx,
    private readonly spawner: Spawner,
    private readonly logger: Logger,
  ) {}

  start(): void {
    for (const cfg of AGENTS) {
      const t = setInterval(() => this.tick(cfg.agent), cfg.intervalMs);
      // Allow the process to exit if cron is the only thing keeping it alive.
      t.unref?.();
      this.timers.push(t);
    }
    this.logger.info({ agents: AGENTS.map((a) => a.agent) }, "cron loop started");
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  private tick(agent: "revenue-watcher" | "service-watcher"): void {
    const projects = this.ctx.repo.listProjects().filter((p) => p.status === "live");
    if (projects.length === 0) return;
    const pluginConfigs = listPluginConfigs(this.ctx.repo);
    for (const p of projects) {
      const plan = this.ctx.repo.getLatestPlan(p.id);
      if (!plan) continue;
      const turn = this.ctx.repo.nextTurnNumber(p.id);
      try {
        this.spawner.spawn({ project_id: p.id, agent, turn, plan, pluginConfigs });
      } catch (err) {
        this.logger.error({ err: String(err), agent, project_id: p.id }, "cron spawn failed");
      }
    }
  }
}
