import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { BusinessPlan } from "@autobiz/shared";

/**
 * If the real Planner LLM is missing or fails, we hand back a keyword-matched
 * fixture plan or a bare-bones default. The seed plan is also used at
 * POST /api/business time so downstream agents always have something to read.
 */

function pickFixture(repoRoot: string, idea: string): BusinessPlan | undefined {
  const path = join(repoRoot, "fixtures", "plans", "demo-3dprint.json");
  if (!existsSync(path)) return undefined;
  const lower = idea.toLowerCase();
  const isPrintish = /(3d print|print-on-demand|maker|etsy)/i.test(lower);
  if (!isPrintish) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as BusinessPlan;
}

export function fallbackPlan(
  project_id: string,
  idea: string,
  owner_contact: { channel: "imessage" | "email"; address: string },
): BusinessPlan {
  const repoRoot = findRepoRoot();
  const fx = pickFixture(repoRoot, idea);
  if (fx) return { ...fx, project_id };
  return {
    project_id,
    version: 1,
    goal: idea,
    vertical: "generic",
    agents: [
      { role: "researcher", task: "Discover competitors and top formats" },
      { role: "verifier", task: "Validate assumptions with Terac" },
      { role: "builder", task: "Ship a Render landing with Stripe payment link" },
      { role: "replay-qa", task: "AI-QA the landing before flipping live" },
      { role: "revenue-watcher", task: "Watch Stripe every 30s" },
      { role: "service-watcher", task: "Watch health every 60s" },
    ],
    budget_usd: 100,
    terac_studies_planned: [
      { topic: "pricing", audience: "general", when: "post-mvp" },
    ],
    owner_contact,
  };
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
