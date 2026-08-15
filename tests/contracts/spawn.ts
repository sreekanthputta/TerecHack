import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const FIXTURES = join(REPO_ROOT, "fixtures");

export function readFixture(rel: string): string {
  return readFileSync(join(FIXTURES, rel), "utf8");
}

/**
 * Rewrite the `env.orchestrator_url` inside a fixture AgentContext to point at
 * the mock orchestrator this test just booted.
 */
export function patchOrchUrl(contextJson: string, orchUrl: string): string {
  const ctx = JSON.parse(contextJson);
  ctx.env.orchestrator_url = orchUrl;
  return JSON.stringify(ctx);
}

export type SpawnResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

/**
 * Run a built agent CLI: `node <repo>/packages/agents/<slug>/dist/run.js`
 * Feeds the given (already url-patched) AgentContext JSON on stdin.
 */
export function runAgent(
  slug: string,
  contextJson: string,
  env: Record<string, string> = {},
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const entry = join(REPO_ROOT, "packages", "agents", slug, "dist", "run.js");
    const child = spawn(process.execPath, [entry], {
      env: {
        ...process.env,
        FIXTURE_MODE: "true",
        TURN_ID: "contract-test",
        ...env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.write(contextJson);
    child.stdin.end();
  });
}
