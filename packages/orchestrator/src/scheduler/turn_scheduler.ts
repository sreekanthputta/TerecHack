import type { AgentName, BusinessPlan, PluginConfig } from "@autobiz/shared";
import type { Logger } from "pino";
import type { Ctx } from "../app.js";
import type { Spawner, SpawnedTurn } from "./spawner.js";

/**
 * Per-project scheduler. Walks planning → researching → building → qa → live
 * with pivot absorption at turn boundaries. Verifier runs in parallel when a
 * low-confidence event lands. Cron watchers start on `live`.
 */
export class TurnScheduler {
  private active = new Map<string, SpawnedTurn>();

  constructor(
    private readonly ctx: Ctx,
    private readonly spawner: Spawner,
    private readonly logger: Logger,
  ) {}

  /** Kick off the initial planner turn (turn 0). */
  startProject(project_id: string, plan: BusinessPlan, pluginConfigs: PluginConfig[]): void {
    this.spawnAndTrack(project_id, "planner", 0, plan, pluginConfigs);
  }

  /** Called when a turn finishes. Decides what comes next. */
  onTurnComplete(project_id: string, agent: AgentName, plan: BusinessPlan, pluginConfigs: PluginConfig[]): void {
    const proj = this.ctx.repo.getProject(project_id);
    if (!proj) return;

    // Absorb queued owner messages at turn boundary
    const nextTurn = this.ctx.repo.nextTurnNumber(project_id);
    const absorbed = this.ctx.repo.absorbMessages(project_id, nextTurn);
    if (absorbed.length > 0) {
      this.ctx.recordEvent({
        project_id,
        turn: nextTurn,
        agent: "orchestrator",
        agent_run_id: "00000000-0000-4000-8000-000000000000",
        type: "pivot_absorbed",
        content: `absorbed ${absorbed.length} owner message(s) for turn ${nextTurn}`,
        ts: new Date().toISOString(),
        metadata: { messages: absorbed.map((m) => m.content) },
      });
      // Pivots always route back to Planner
      this.ctx.repo.updateProjectStatus(project_id, "pivoting");
      this.spawnAndTrack(project_id, "planner", nextTurn, plan, pluginConfigs, {
        messages: absorbed.map((m) => m.content),
      });
      return;
    }

    switch (agent) {
      case "planner": {
        this.ctx.repo.updateProjectStatus(project_id, "researching");
        this.spawnAndTrack(project_id, "researcher", nextTurn, plan, pluginConfigs);
        return;
      }
      case "researcher": {
        this.ctx.repo.updateProjectStatus(project_id, "building");
        this.spawnAndTrack(project_id, "builder", nextTurn, plan, pluginConfigs);
        return;
      }
      case "builder": {
        // QA runs after every build
        this.ctx.repo.updateProjectStatus(project_id, "qa");
        this.spawnAndTrack(project_id, "replay-qa", nextTurn, plan, pluginConfigs);
        return;
      }
      case "replay-qa": {
        const openBugs = this.ctx.repo.countOpenBugs(project_id);
        if (openBugs > 0) {
          const v = this.ctx.repo.bumpBuilderVersion(project_id);
          const prior_bugs = this.ctx.repo.listOpenBugs(project_id).map((b) => ({
            bug_id: b.bug_id,
            severity: b.severity,
            where: b.where_,
            observed: b.observed,
            expected: b.expected,
            repro: JSON.parse(b.repro_json) as string[],
          }));
          this.ctx.repo.updateProjectStatus(project_id, "building");
          this.spawnAndTrack(project_id, "builder", nextTurn, plan, pluginConfigs, { prior_bugs });
          this.logger.info({ project_id, builder_version: v, openBugs }, "spawning builder for bug fixes");
          return;
        }
        // Green run — Replay QA sets status=live via /internal/state directly.
        this.logger.info({ project_id }, "replay-qa green; no follow-up");
        return;
      }
      case "verifier": {
        // Verifier is off the linear path; no automatic follow-up.
        return;
      }
      case "revenue-watcher":
      case "service-watcher":
      case "orchestrator":
        return;
    }
  }

  /** Verifier runs in parallel when confidence<0.6. */
  spawnVerifier(project_id: string, plan: BusinessPlan, pluginConfigs: PluginConfig[]): void {
    const turn = this.ctx.repo.nextTurnNumber(project_id);
    this.spawnAndTrack(project_id, "verifier", turn, plan, pluginConfigs);
  }

  private spawnAndTrack(
    project_id: string,
    agent: Exclude<AgentName, "orchestrator">,
    turn: number,
    plan: BusinessPlan,
    pluginConfigs: PluginConfig[],
    extras: { prior_bugs?: import("@autobiz/shared").Bug[]; messages?: string[] } = {},
  ): void {
    const spawned = this.spawner.spawn({ project_id, agent, turn, plan, extras, pluginConfigs });
    this.active.set(spawned.turn_id, spawned);
    spawned.onDone
      .then(() => {
        this.active.delete(spawned.turn_id);
        // Re-fetch latest plan (may have been bumped mid-turn)
        const latest = this.ctx.repo.getLatestPlan(project_id) ?? plan;
        this.onTurnComplete(project_id, agent, latest, pluginConfigs);
      })
      .catch((err: unknown) => {
        this.logger.error({ err: String(err), turn_id: spawned.turn_id }, "turn onDone rejected");
      });
  }
}
