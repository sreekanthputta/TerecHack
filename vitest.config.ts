import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", ".claude/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
  },
});
