/**
 * Fires a fake Linq tapback webhook at the local integrations server, so the
 * demo can exercise the approval → orchestrator pivot flow without a real
 * iMessage. In fixture mode, signature verification is bypassed if
 * LINQ_WEBHOOK_SECRET is unset.
 *
 * Usage:
 *   tsx scripts/simulate-linq-approval.ts <project_id> [approve|reject]
 *   PORT=4100 tsx scripts/simulate-linq-approval.ts abc123 approve
 */
import { createHmac } from "node:crypto";

async function main() {
  const [, , projectArg, actionArg] = process.argv;
  if (!projectArg) {
    console.error("usage: simulate-linq-approval.ts <project_id> [approve|reject]");
    process.exit(1);
  }
  const project_id = projectArg;
  const action = (actionArg ?? "approve") as "approve" | "reject";
  const port = Number(process.env.INTEGRATIONS_PORT ?? process.env.PORT ?? 4100);
  const url = `http://127.0.0.1:${port}/linq/webhook`;
  const body = JSON.stringify({
    event: "tapback",
    action,
    metadata: { project_id },
  });
  const secret = process.env.LINQ_WEBHOOK_SECRET ?? "";
  const signature = secret
    ? "sha256=" + createHmac("sha256", secret).update(body).digest("hex")
    : "sha256=fixture";
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-linq-signature": signature },
    body,
  });
  const text = await res.text();
  console.log(res.status, text);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
