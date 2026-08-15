import { describe, expect, it } from "vitest";
import { startMockOrchestrator } from "./mock-orchestrator.js";
import { patchOrchUrl, readFixture, runAgent } from "./spawn.js";

describe("agent-verifier contract", () => {
  it("stub emits a thought and a terminal result via HTTP", async () => {
    const orch = await startMockOrchestrator();
    try {
      const ctx = patchOrchUrl(readFixture("contexts/verifier.json"), orch.url);
      const res = await runAgent("verifier", ctx);

      expect(res.code, `stderr: ${res.stderr}`).toBe(0);
      expect(orch.events.length).toBeGreaterThanOrEqual(1);
      expect(orch.events.some((e) => e.type === "result")).toBe(true);
      expect(orch.events.every((e) => e.agent === "verifier")).toBe(true);
      expect(orch.events.every((e) => e.project_id === "01HXDEMO3DPRINT000000000000")).toBe(true);
    } finally {
      await orch.stop();
    }
  });
});
