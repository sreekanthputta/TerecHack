import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const ENTRY = join(REPO_ROOT, "packages", "orchestrator", "dist", "server.js");

async function waitForHealth(url: string, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function bootOrchestrator(env: Record<string, string>): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [ENTRY], {
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("orchestrator contract", () => {
  const children: ChildProcessWithoutNullStreams[] = [];

  afterAll(() => {
    for (const c of children) c.kill("SIGTERM");
  });

  it("boots on :4000 and /health returns { ok: true }", async () => {
    const child = bootOrchestrator({ ORCH_PORT: "4010" });
    children.push(child);
    const ok = await waitForHealth("http://127.0.0.1:4010/health");
    expect(ok).toBe(true);

    const res = await fetch("http://127.0.0.1:4010/health");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.service).toBe("orchestrator");
  });

  it("refuses to boot when STRIPE_RESTRICTED_KEY starts with sk_", async () => {
    const child = spawn(process.execPath, [ENTRY], {
      env: {
        ...process.env,
        ORCH_PORT: "4011",
        STRIPE_RESTRICTED_KEY: "sk_test_abc",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    const code: number = await new Promise((resolve) => child.on("close", (c) => resolve(c ?? 0)));
    expect(code).toBe(1);
    expect(stderr).toContain("sk_");
  });
});
