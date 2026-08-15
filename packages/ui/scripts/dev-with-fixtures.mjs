#!/usr/bin/env node
// Starts the mock orchestrator on :4000 + `next dev` on ${UI_PORT:-3000}.
// One command, no external orchestrator required.

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const UI_ROOT = resolve(HERE, "..");
const UI_PORT = process.env.UI_PORT ?? "3000";
const MOCK_PORT = process.env.MOCK_PORT ?? "4000";

const children = [];

function launch(name, cmd, args, env) {
  const child = spawn(cmd, args, {
    cwd: UI_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  child.stdout.on("data", (b) => process.stdout.write(`[${name}] ${b}`));
  child.stderr.on("data", (b) => process.stderr.write(`[${name}] ${b}`));
  child.on("exit", (code) => {
    console.log(`[demo] ${name} exited (${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

function shutdown(code) {
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[demo] booting mock orchestrator + Next.js dev");
launch("mock", process.execPath, [resolve(HERE, "mock-server.mjs")], { MOCK_PORT });
launch(
  "next",
  "node_modules/.bin/next",
  ["dev", "-p", UI_PORT],
  { NEXT_PUBLIC_ORCHESTRATOR_URL: `http://localhost:${MOCK_PORT}` },
);
