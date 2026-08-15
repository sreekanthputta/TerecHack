#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const MAP = {
  "agent-a-ui.md":                { slug: "agent-a-ui",               pkg: "@autobiz/ui",                 pkgPath: "packages/ui" },
  "agent-b-orchestrator.md":      { slug: "agent-b-orch",             pkg: "@autobiz/orchestrator",       pkgPath: "packages/orchestrator" },
  "agent-c0-planner.md":          { slug: "agent-c0-planner",         pkg: "@autobiz/agent-planner",      pkgPath: "packages/agents/planner" },
  "agent-c1-researcher.md":       { slug: "agent-c1-researcher",      pkg: "@autobiz/agent-researcher",   pkgPath: "packages/agents/researcher" },
  "agent-c2-builder.md":          { slug: "agent-c2-builder",         pkg: "@autobiz/agent-builder",      pkgPath: "packages/agents/builder" },
  "agent-c3-verifier.md":         { slug: "agent-c3-verifier",        pkg: "@autobiz/agent-verifier",     pkgPath: "packages/agents/verifier" },
  "agent-c4-replay-qa.md":        { slug: "agent-c4-replay-qa",       pkg: "@autobiz/agent-replay-qa",    pkgPath: "packages/agents/replay-qa" },
  "agent-d1-revenue-watcher.md":  { slug: "agent-d1-revenue-watcher", pkg: "@autobiz/agent-revenue-watcher", pkgPath: "packages/agents/revenue-watcher" },
  "agent-d2-service-watcher.md":  { slug: "agent-d2-service-watcher", pkg: "@autobiz/agent-service-watcher", pkgPath: "packages/agents/service-watcher" },
  "agent-e-integrations.md":      { slug: "agent-e-integrations",     pkg: "@autobiz/integrations",       pkgPath: "packages/integrations" },
};

const MARKER_START = "<!-- WORKTREE-SETUP:START -->";
const MARKER_END   = "<!-- WORKTREE-SETUP:END -->";

const sectionFor = ({ slug, pkg, pkgPath }) => `${MARKER_START}
## Worktree setup

You work in \`.claude/worktrees/${slug}/\` on branch \`feat/${slug}\`. From that directory:

- **Only write files inside \`${pkgPath}/\`.** Root files (\`pnpm-workspace.yaml\`, root \`package.json\`, \`pnpm-lock.yaml\`, \`tests/contracts/\`) are frozen for Phase A. If you need a new runtime dep, add it via \`pnpm --filter ${pkg} add <dep>\` — pnpm updates the root lockfile in your branch only.
- **Schema changes are forbidden here.** If your work needs to add a field to a shared type, STOP and follow [CONTRACTS.md §9](../CONTRACTS.md).
- **Merge gate** (must be green before push):
  \`\`\`bash
  pnpm --filter ${pkg} build
  pnpm --filter ${pkg} test:contracts
  \`\`\`
- **Commit cadence:** one commit per completed checkbox. Small commits, clear messages.
- **Push:** \`git push -u origin feat/${slug}\`
- **PR:** open against \`main\` when every checkbox is done and Definition of Done is met. The contract test suite re-runs on the PR branch — green = merge.
- **If your worktree gets stale**, rebase on \`main\`: \`git fetch origin && git rebase origin/main\`. Do not force-push shared branches.
${MARKER_END}`;

for (const [file, cfg] of Object.entries(MAP)) {
  const path = join(REPO_ROOT, "agents", file);
  const raw = readFileSync(path, "utf8");
  const section = sectionFor(cfg);

  let next;
  if (raw.includes(MARKER_START)) {
    next = raw.replace(
      new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`),
      section,
    );
  } else {
    // Inject right before "## Standalone demo" if that heading exists,
    // otherwise append at end of file.
    if (raw.includes("## Standalone demo")) {
      next = raw.replace("## Standalone demo", section + "\n\n## Standalone demo");
    } else {
      next = raw.trimEnd() + "\n\n" + section + "\n";
    }
  }
  writeFileSync(path, next, "utf8");
  console.log(`updated ${file}`);
}
