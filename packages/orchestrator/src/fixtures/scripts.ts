import type { AgentName, Bug, DecisionRecord } from "@autobiz/shared";
import type { Ctx } from "../app.js";

/**
 * In-process "stubs" that stand in for spawned agents when FIXTURE_MODE=true.
 * Each script:
 *   - inserts trace events via ctx.recordEvent
 *   - performs the same side-effects a real agent would post over HTTP:
 *     state patches, bug reports, decisions, plan updates
 *
 * We embed these here because the worktree cannot write to fixtures/agents/.
 * Everything is deterministic and time-bounded so demos run in ~90s.
 */

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function runFixtureScript(
  ctx: Ctx,
  input: {
    project_id: string;
    turn: number;
    agent: AgentName;
    agent_run_id: string;
    turn_id: string;
    prior_bugs: Bug[];
    messages: string[];
  },
): Promise<void> {
  const { project_id, turn, agent, agent_run_id, prior_bugs, messages } = input;
  const emit = (
    type: import("@autobiz/shared").TraceEventType,
    content: string,
    extras: { confidence?: number; metadata?: Record<string, unknown> } = {},
  ): void => {
    ctx.recordEvent({
      project_id,
      turn,
      agent,
      agent_run_id,
      type,
      content,
      ts: new Date().toISOString(),
      ...(extras.confidence !== undefined ? { confidence: extras.confidence } : {}),
      ...(extras.metadata ? { metadata: extras.metadata } : {}),
    });
  };

  const wait = ctx.env.node_env === "test" ? 5 : 200;

  switch (agent) {
    case "planner": {
      const isPivot = messages.length > 0;
      emit("thought", isPivot
        ? `Absorbing owner pivot: ${messages[0]?.slice(0, 200)}`
        : "Reading owner goal and workspace memory");
      await sleep(wait);
      const plan = ctx.repo.getLatestPlan(project_id);
      if (plan) {
        const bumped = { ...plan, version: plan.version + (isPivot ? 1 : 0) };
        if (isPivot) {
          ctx.repo.insertPlan(bumped);
          ctx.repo.bumpPlanVersion(project_id, bumped.version);
          emit("plan_update", `Plan v${bumped.version} — pivot absorbed`);
        } else {
          emit("plan_update", `Plan v${plan.version} — ${plan.vertical}, budget $${plan.budget_usd}`);
        }
      }
      await sleep(wait);
      emit("result", "Planner done. Handoff to researcher.");
      return;
    }
    case "researcher": {
      emit("action", "Searching Etsy top sellers under $25");
      await sleep(wait);
      emit("thought", "Cross-referencing Reddit r/3Dprinting for repeat-buy signals");
      await sleep(wait);
      emit("result", "Top pick: cable organizers", { confidence: 0.5 });
      return;
    }
    case "verifier": {
      emit("action", "Confidence low; consulting 15 real makers via Terac");
      emit("terac_call", "Which of these niches would you actually buy? cable organizers / phone stands / planter pots");
      await sleep(wait * 3);
      emit("terac_result", "12/15 makers picked cable organizers");
      const decision: DecisionRecord = {
        project_id,
        decision_id: `d${Math.random().toString(36).slice(2, 9)}`,
        topic: "niche-validation",
        before: { value: "cable organizers", confidence: 0.5, reasoning: "researcher hunch" },
        after: { value: "cable organizers", confidence: 0.85, reasoning: "12/15 makers agreed" },
        aggregate: "12/15 makers picked cable organizers over phone stands and planter pots",
        ts: new Date().toISOString(),
      };
      ctx.repo.insertDecision(decision);
      ctx.repo.incrementDecisions(project_id);
      emit("decision", `${decision.topic}: ${decision.aggregate}`, {
        confidence: decision.after.confidence,
        metadata: { decision_id: decision.decision_id, topic: decision.topic },
      });
      emit("result", "Verifier done. Decision recorded.");
      return;
    }
    case "builder": {
      const version = ctx.repo.getProject(project_id)?.builder_version ?? 0;
      const iteration = Math.max(1, version + (prior_bugs.length === 0 ? 1 : 0));
      emit("action", prior_bugs.length > 0
        ? `Builder v${iteration} — fixing ${prior_bugs.length} bug(s)`
        : `Builder v${iteration} — generating landing "CableCraft"`);
      await sleep(wait);
      if (prior_bugs.length > 0) {
        emit("bugs_fixed", `fixed ${prior_bugs.length} bug(s) from replay-qa v${prior_bugs[0]?.bug_id ?? "n/a"}`);
        ctx.repo.markBugsFixed(project_id, iteration);
        ctx.repo.setBugsOpen(project_id, ctx.repo.countOpenBugs(project_id));
      }
      const landing = `https://cablecraft-${project_id.slice(-6).toLowerCase()}.onrender.com`;
      const stripeLink = `https://buy.stripe.com/test_${project_id.slice(-8).toLowerCase()}`;
      ctx.repo.patchBusinessState(project_id, {
        landing_url: landing,
        stripe_payment_link: stripeLink,
        builder_version: iteration,
      });
      emit("deploy", `Deployed ${landing}`, { metadata: { url: landing } });
      emit("result", "Builder done. Handoff to Replay QA.");
      return;
    }
    case "replay-qa": {
      const builderVersion = ctx.repo.getProject(project_id)?.builder_version ?? 1;
      emit("action", `Replay QA v${builderVersion} — running canned journeys`);
      await sleep(wait * 2);
      if (builderVersion === 1) {
        // First run: report 2 bugs
        const bugs: Bug[] = [
          {
            bug_id: `b${Math.random().toString(36).slice(2, 9)}`,
            severity: "major",
            where: "/api/cart",
            observed: "returned 404 on SKU-2",
            expected: "return 200 with cart line",
            repro: ["add SKU-2", "GET /api/cart"],
          },
          {
            bug_id: `b${Math.random().toString(36).slice(2, 9)}`,
            severity: "minor",
            where: "/checkout",
            observed: "misaligned Stripe button on Safari",
            expected: "centered button on all browsers",
            repro: ["open Safari", "click checkout"],
          },
        ];
        ctx.repo.insertBugs(project_id, builderVersion, bugs, new Date().toISOString());
        ctx.repo.setBugsOpen(project_id, ctx.repo.countOpenBugs(project_id));
        emit("bugs_found", `passed=8 failed=2 (v${builderVersion})`, {
          metadata: { failed: bugs.length, passed: 8 },
        });
        emit("result", "Replay QA reported bugs; handoff to Builder.");
        return;
      }
      // Second run: green
      emit("bugs_fixed", "0 failures on replay after fixes");
      ctx.repo.patchBusinessState(project_id, { status: "live", bugs_open: 0 });
      emit("result", "Replay QA green. Business is LIVE.");
      return;
    }
    case "revenue-watcher": {
      const proj = ctx.repo.getProject(project_id);
      if (!proj || proj.status !== "live") return;
      const state = ctx.repo.getBusinessState(project_id);
      const nextBalance = (state?.stripe_balance_usd ?? 0) + 12;
      const nextCount = (state?.charges_count ?? 0) + 1;
      ctx.repo.patchBusinessState(project_id, {
        stripe_balance_usd: nextBalance,
        charges_count: nextCount,
      });
      emit("sale", `+$12 sale (balance $${nextBalance})`, { metadata: { balance_usd: nextBalance } });
      return;
    }
    case "service-watcher": {
      emit("health_check", "uptime 100% · p95 240ms · errors 0", {
        metadata: { uptime_pct: 100, p95_latency_ms: 240 },
      });
      ctx.repo.patchBusinessState(project_id, {
        uptime_pct: 100,
        p95_latency_ms: 240,
        errors_last_5m: 0,
      });
      return;
    }
    case "orchestrator":
      return;
  }

  // Reference unused vars to keep TS happy in edge cases
  void agent_run_id;
}
