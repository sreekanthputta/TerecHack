import { describe, expect, it } from "vitest";
import { startMockOrchestrator } from "./mock-orchestrator.js";
import { patchOrchUrl, readFixture, runAgent } from "./spawn.js";

describe("agent-service-watcher contract", () => {
  it("stub emits a thought and a terminal result via HTTP", async () => {
    const orch = await startMockOrchestrator();
    try {
      const ctx = patchOrchUrl(readFixture("contexts/service-watcher.json"), orch.url);
      const res = await runAgent("service-watcher", ctx);

      expect(res.code, `stderr: ${res.stderr}`).toBe(0);
      expect(orch.events.length).toBeGreaterThanOrEqual(1);
      expect(orch.events.some((e) => e.type === "result")).toBe(true);
      expect(orch.events.every((e) => e.agent === "service-watcher")).toBe(true);
      expect(orch.events.every((e) => e.project_id === "01HXDEMO3DPRINT000000000000")).toBe(true);
    } finally {
      await orch.stop();
    }
  });
});
