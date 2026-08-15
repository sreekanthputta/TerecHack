import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const ENTRY = join(REPO_ROOT, "packages", "integrations", "dist", "server.js");

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

describe("integrations contract", () => {
  const children: ChildProcessWithoutNullStreams[] = [];

  afterAll(() => {
    for (const c of children) c.kill("SIGTERM");
  });

  it("boots in FIXTURE_MODE and every stub endpoint responds", async () => {
    const child = spawn(process.execPath, [ENTRY], {
      env: {
        ...process.env,
        INTEGRATIONS_PORT: "4110",
        FIXTURE_MODE: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);

    const ok = await waitForHealth("http://127.0.0.1:4110/health");
    expect(ok).toBe(true);

    const health = await (await fetch("http://127.0.0.1:4110/health")).json();
    expect(health.ok).toBe(true);
    expect(health.service).toBe("integrations");
    expect(health.fixture_mode).toBe(true);

    // A representative stub sample across providers
    const askRes = await fetch("http://127.0.0.1:4110/terac/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: "p1",
        question: "q?",
        audience: "general",
        target_responses: 5,
        why_asking: "demo",
      }),
    });
    expect(askRes.ok).toBe(true);
    const askBody = await askRes.json();
    expect(typeof askBody.ask_id).toBe("string");

    const replayCreate = await fetch("http://127.0.0.1:4110/replay/project", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_id: "p1",
        base_url: "https://example.onrender.com",
        design_document: "# stub",
      }),
    });
    expect(replayCreate.ok).toBe(true);
    const replayBody = await replayCreate.json();
    expect(replayBody).toMatchObject({
      id: expect.any(String),
      url: expect.stringMatching(/^https:\/\/qa\.replay\.io/),
      exploration_id: expect.any(String),
    });
  });
});
