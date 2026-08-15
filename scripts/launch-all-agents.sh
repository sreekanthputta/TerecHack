#!/usr/bin/env bash
# Opens 10 Terminal.app tabs, one per agent worktree.
# Each tab: cd into worktree, run `claude` with the ralph-loop prompt.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCH_DIR="$REPO_ROOT/.claude/launchers"
mkdir -p "$LAUNCH_DIR"

# slug | prd | pkg | pkgpath
AGENTS=(
  "agent-a-ui|agent-a-ui.md|@autobiz/ui|packages/ui"
  "agent-b-orch|agent-b-orchestrator.md|@autobiz/orchestrator|packages/orchestrator"
  "agent-c0-planner|agent-c0-planner.md|@autobiz/agent-planner|packages/agents/planner"
  "agent-c1-researcher|agent-c1-researcher.md|@autobiz/agent-researcher|packages/agents/researcher"
  "agent-c2-builder|agent-c2-builder.md|@autobiz/agent-builder|packages/agents/builder"
  "agent-c3-verifier|agent-c3-verifier.md|@autobiz/agent-verifier|packages/agents/verifier"
  "agent-c4-replay-qa|agent-c4-replay-qa.md|@autobiz/agent-replay-qa|packages/agents/replay-qa"
  "agent-d1-revenue-watcher|agent-d1-revenue-watcher.md|@autobiz/agent-revenue-watcher|packages/agents/revenue-watcher"
  "agent-d2-service-watcher|agent-d2-service-watcher.md|@autobiz/agent-service-watcher|packages/agents/service-watcher"
  "agent-e-integrations|agent-e-integrations.md|@autobiz/integrations|packages/integrations"
)

for row in "${AGENTS[@]}"; do
  IFS='|' read -r slug prd pkg pkgpath <<< "$row"
  wt="$REPO_ROOT/.claude/worktrees/$slug"
  launcher="$LAUNCH_DIR/$slug.sh"

  cat > "$launcher" <<LAUNCHER
#!/usr/bin/env bash
cd "$wt"
exec claude --dangerously-skip-permissions "Read agents/$prd front-to-back. You are in worktree $slug on branch feat/$slug. Only write files inside $pkgpath/. Ralph-loop the Tasks checklist: pick the next unchecked box, do it, commit, repeat. Your merge gate is: pnpm --filter $pkg build && pnpm --filter $pkg test:contracts — both must be green before any push. When every checkbox is checked and Definition of Done is met, run git push -u origin feat/$slug and stop. Do not touch anything outside $pkgpath/."
LAUNCHER
  chmod +x "$launcher"

  osascript >/dev/null <<APPLESCRIPT
tell application "Terminal"
  activate
  do script "$launcher"
end tell
APPLESCRIPT

  echo "launched $slug"
  sleep 2
done

echo ""
echo "All 10 agent sessions launched in Terminal tabs."
echo "Watch each tab; when one pushes its branch, open its PR against main."
