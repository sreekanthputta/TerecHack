import { describe, expect, it } from "vitest";
import { startMockOrchestrator } from "./mock-orchestrator.js";
import { patchOrchUrl, readFixture, runAgent } from "./spawn.js";

describe("agent-builder contract", () => {
  it("v1 (no prior_bugs) emits a result via HTTP", async () => {
    const orch = await startMockOrchestrator();
    try {
      const ctx = patchOrchUrl(readFixture("contexts/builder-v1.json"), orch.url);
      const res = await runAgent("builder", ctx);

      expect(res.code, `stderr: ${res.stderr}`).toBe(0);
      expect(orch.events.length).toBeGreaterThanOrEqual(1);
      expect(orch.events.some((e) => e.type === "result")).toBe(true);
      expect(orch.events.every((e) => e.agent === "builder")).toBe(true);
    } finally {
      await orch.stop();
    }
  });

  it("v2 (with prior_bugs) still parses AgentContext and emits a result", async () => {
    const orch = await startMockOrchestrator();
    try {
      const ctx = patchOrchUrl(readFixture("contexts/builder-v2.json"), orch.url);
      const res = await runAgent("builder", ctx);

      expect(res.code, `stderr: ${res.stderr}`).toBe(0);
      expect(orch.events.some((e) => e.type === "result")).toBe(true);
    } finally {
      await orch.stop();
    }
  });
});
