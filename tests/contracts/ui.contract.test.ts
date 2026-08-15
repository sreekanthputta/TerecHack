import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const UI_BUILD_DIR = join(__dirname, "..", "..", "packages", "ui", ".next");

describe("ui contract", () => {
  it("has a Next.js build output (packages/ui/.next) after pnpm build", () => {
    // The root-level `pnpm build` runs `next build` for @autobiz/ui.
    // If this test fails, run `pnpm --filter @autobiz/ui build` first.
    expect(existsSync(UI_BUILD_DIR), `expected ${UI_BUILD_DIR} to exist`).toBe(true);
  });
});
