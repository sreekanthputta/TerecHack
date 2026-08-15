import type { AgentContext } from "@autobiz/shared";

export type ReplayInputs = {
  turnId: string;
  runNumber: number;
  builderVersion: number;
  landingUrl: string;
  productSummary: string;
  priorBugIds: string[];
};

const RUN_REPORT_RE = /^replay\/run-(\d+)-report\.md$/;

/**
 * Count replay/run-N-report.md entries in project memory to figure out which
 * build we are testing. First-ever run → 1.
 */
export function deriveRunNumber(ctx: AgentContext): number {
  let highest = 0;
  for (const path of ctx.memory.project) {
    const m = RUN_REPORT_RE.exec(path);
    if (m) {
      const n = Number(m[1]);
      if (n > highest) highest = n;
    }
  }
  return highest + 1;
}

async function fetchLandingUrl(ctx: AgentContext): Promise<string | undefined> {
  try {
    const res = await fetch(`${ctx.env.orchestrator_url}/internal/turns/${ctx.turn_id}/state`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { landing_url?: string };
    return body.landing_url;
  } catch {
    return undefined;
  }
}

const FIXTURE_LANDING_URL = "https://autobiz-3dprint-store.demo.render.com/";

export async function readInputs(ctx: AgentContext): Promise<ReplayInputs> {
  const runNumber = deriveRunNumber(ctx);
  const landingUrl = (await fetchLandingUrl(ctx)) ?? FIXTURE_LANDING_URL;
  const productSummary = `${ctx.plan.goal} (vertical: ${ctx.plan.vertical})`;
  const priorBugIds = (ctx.prior_bugs ?? []).map((b) => b.bug_id);
  return {
    turnId: ctx.turn_id,
    runNumber,
    builderVersion: runNumber,
    landingUrl,
    productSummary,
    priorBugIds,
  };
}
