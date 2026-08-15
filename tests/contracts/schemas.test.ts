import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AgentContextSchema,
  BugReportSchema,
  BusinessPlanSchema,
  TeracRawResponseSchema,
  TraceEventSchema,
} from "@autobiz/shared";

const FIXTURES = join(__dirname, "..", "..", "fixtures");

describe("fixtures/plans/*.json parse against BusinessPlanSchema", () => {
  const dir = join(FIXTURES, "plans");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    it(`plans/${file}`, () => {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const result = BusinessPlanSchema.safeParse(raw);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });
  }
});

describe("fixtures/contexts/*.json parse against AgentContextSchema", () => {
  const dir = join(FIXTURES, "contexts");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    it(`contexts/${file}`, () => {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const result = AgentContextSchema.safeParse(raw);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });
  }
});

describe("fixtures/traces/*.jsonl parse against TraceEventSchema", () => {
  const dir = join(FIXTURES, "traces");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".jsonl")) continue;
    it(`traces/${file}`, () => {
      const lines = readFileSync(join(dir, file), "utf8").trim().split("\n");
      for (const line of lines) {
        const result = TraceEventSchema.safeParse(JSON.parse(line));
        expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
      }
    });
  }
});

describe("misc plugin fixtures", () => {
  it("plugins/terac-response.json is a valid TeracRawResponse", () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, "plugins", "terac-response.json"), "utf8"));
    const result = TeracRawResponseSchema.safeParse(raw);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it("plugins/replay-qa-bugs.json is a valid BugReport", () => {
    const raw = JSON.parse(readFileSync(join(FIXTURES, "plugins", "replay-qa-bugs.json"), "utf8"));
    const result = BugReportSchema.safeParse(raw);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });
});
