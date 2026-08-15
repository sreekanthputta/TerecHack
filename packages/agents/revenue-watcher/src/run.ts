import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  AgentContextSchema,
  type AgentContext,
  type TraceEventInput,
} from "@autobiz/shared";

const AGENT = "revenue-watcher" as const;
const EPOCH_ISO = "1970-01-01T00:00:00.000Z";
const MILESTONES = [10, 100, 1000, 10000] as const;

type Charge = {
  id: string;
  amount_usd: number;
  ts: string;
  product?: string;
  status?: string;
};

type ChargesResponse = {
  charges: Charge[];
  balance_usd: number;
  count: number;
};

type WatcherMetadata = {
  last_charge_ts?: string;
  fixture_cursor?: number;
  milestones_fired?: number[];
  first_sale_fired?: boolean;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function baseFor(ctx: AgentContext) {
  return {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  } as const;
}

async function postEvent(
  orchUrl: string,
  turnId: string,
  event: TraceEventInput,
): Promise<void> {
  const res = await fetch(`${orchUrl}/internal/turns/${turnId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error(`POST event failed: ${res.status}`);
}

async function postState(
  orchUrl: string,
  turnId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await fetch(`${orchUrl}/internal/turns/${turnId}/state`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  }).catch(() => undefined);
}

async function postMemory(
  orchUrl: string,
  turnId: string,
  path: string,
  content: string,
): Promise<void> {
  await fetch(`${orchUrl}/internal/turns/${turnId}/memory`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, content }),
  }).catch(() => undefined);
}

async function linqNotify(
  intUrl: string,
  projectId: string,
  message: string,
): Promise<void> {
  await fetch(`${intUrl}/linq/notify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, message }),
  }).catch(() => undefined);
}

function fixtureFilePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "..", "fixtures", "stripe", "charges.jsonl");
}

function loadFixtureCharges(): Charge[] {
  const p = fixtureFilePath();
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as Charge);
}

function fixtureFetch(cursor: number): { batch: Charge[]; nextCursor: number } {
  const all = loadFixtureCharges();
  if (cursor >= all.length) return { batch: [], nextCursor: cursor };
  // one tick's worth: emit up to 2 unread charges per tick so DoD's
  // "given 2 new charges" scenario is reachable, then advance the cursor.
  const remaining = all.length - cursor;
  const take = Math.min(remaining, 2);
  const batch = all.slice(cursor, cursor + take);
  return { batch, nextCursor: cursor + take };
}

function fixtureTotals(nextCursor: number): { balance: number; count: number } {
  const all = loadFixtureCharges();
  const seen = all.slice(0, nextCursor);
  return {
    balance: seen.reduce((s, c) => s + c.amount_usd, 0),
    count: seen.length,
  };
}

async function livePoll(
  intUrl: string,
  projectId: string,
  since: string,
): Promise<ChargesResponse> {
  const url = `${intUrl}/stripe/charges/${encodeURIComponent(projectId)}?since=${encodeURIComponent(since)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`stripe charges ${res.status}`);
  const body = (await res.json()) as Partial<ChargesResponse>;
  return {
    charges: Array.isArray(body.charges) ? (body.charges as Charge[]) : [],
    balance_usd: typeof body.balance_usd === "number" ? body.balance_usd : 0,
    count: typeof body.count === "number" ? body.count : 0,
  };
}

function renderRevenueMemory(
  projectId: string,
  balance: number,
  count: number,
  charges: Charge[],
  notable: string[],
  nowIso: string,
): string {
  const last10 = charges.slice(-10).reverse();
  const rows = last10
    .map(
      (c) =>
        `- \`${c.id}\` · $${c.amount_usd} · ${c.ts} · ${c.product ?? "unknown"}`,
    )
    .join("\n");
  const notableBlock =
    notable.length > 0 ? notable.map((n) => `- ${n}`).join("\n") : "- —";
  return `---
type: ops
project_id: ${projectId}
updated_at: ${nowIso}
---

# Revenue

## Totals
- Balance: **$${balance.toFixed(2)}**
- Charges count: **${count}**

## Last ${last10.length} charge${last10.length === 1 ? "" : "s"}
${rows.length > 0 ? rows : "- —"}

## Notable events
${notableBlock}
`;
}

async function main(): Promise<void> {
  const raw = await readStdin();
  const rawJson: unknown = JSON.parse(raw);
  const ctx = AgentContextSchema.parse(rawJson);
  const metaIn: WatcherMetadata =
    typeof rawJson === "object" && rawJson !== null && "metadata" in rawJson
      ? ((rawJson as { metadata?: WatcherMetadata }).metadata ?? {})
      : {};

  const orchUrl = ctx.env.orchestrator_url;
  const intUrl = ctx.env.integrations_url;
  const turnId = ctx.turn_id;
  const nowIso = () => new Date().toISOString();
  const base = baseFor(ctx);
  const fixtureMode = ctx.env.fixture_mode === true;

  const since = metaIn.last_charge_ts ?? EPOCH_ISO;
  const cursorIn = metaIn.fixture_cursor ?? 0;
  const milestonesFired = new Set<number>(metaIn.milestones_fired ?? []);
  const firstSaleFired = metaIn.first_sale_fired === true;

  // Poll
  let response: ChargesResponse;
  let nextCursor = cursorIn;
  try {
    if (fixtureMode) {
      const { batch, nextCursor: nc } = fixtureFetch(cursorIn);
      nextCursor = nc;
      const totals = fixtureTotals(nc);
      response = {
        charges: batch,
        balance_usd: totals.balance,
        count: totals.count,
      };
    } else {
      response = await livePoll(intUrl, ctx.project_id, since);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await postEvent(orchUrl, turnId, {
      ...base,
      type: "error",
      content: `stripe poll failed: ${msg}`,
      ts: nowIso(),
    });
    await postState(orchUrl, turnId, {
      metadata: metaIn,
    });
    await postEvent(orchUrl, turnId, {
      ...base,
      type: "result",
      content: `revenue-watcher tick complete (poll failure, no changes)`,
      ts: nowIso(),
    });
    return;
  }

  // No new charges → single action + unchanged state + result
  if (response.charges.length === 0) {
    await postEvent(orchUrl, turnId, {
      ...base,
      type: "action",
      content: "no new charges",
      ts: nowIso(),
    });
    await postState(orchUrl, turnId, {
      stripe_balance_usd: response.balance_usd,
      charges_count: response.count,
      metadata: { ...metaIn, fixture_cursor: nextCursor },
    });
    await postEvent(orchUrl, turnId, {
      ...base,
      type: "result",
      content: "revenue-watcher tick complete (no new charges)",
      ts: nowIso(),
    });
    return;
  }

  // New charges: emit sale events + milestones
  const notable: string[] = [];
  const nextMilestonesFired = new Set(milestonesFired);
  let nextFirstSaleFired = firstSaleFired;

  for (const c of response.charges) {
    await postEvent(orchUrl, turnId, {
      ...base,
      type: "sale",
      content: `$${c.amount_usd} sale on ${c.product ?? "unknown"}`,
      ts: nowIso(),
      metadata: {
        amount_usd: c.amount_usd,
        charge_id: c.id,
        product: c.product,
        occurred_at: c.ts,
      },
    });
  }

  if (!nextFirstSaleFired) {
    await linqNotify(
      intUrl,
      ctx.project_id,
      `🎉 First-ever sale for ${ctx.project_id}: $${response.charges[0]!.amount_usd} on ${response.charges[0]!.product ?? "unknown"}`,
    );
    notable.push(`First-ever sale: charge \`${response.charges[0]!.id}\``);
    nextFirstSaleFired = true;
  }

  for (const threshold of MILESTONES) {
    if (response.balance_usd >= threshold && !nextMilestonesFired.has(threshold)) {
      await linqNotify(
        intUrl,
        ctx.project_id,
        `💰 Balance crossed $${threshold} for ${ctx.project_id} (now $${response.balance_usd.toFixed(2)})`,
      );
      notable.push(`Balance crossed $${threshold}`);
      nextMilestonesFired.add(threshold);
    }
  }

  const latestChargeTs = response.charges.reduce(
    (max, c) => (c.ts > max ? c.ts : max),
    since,
  );

  const nextMeta: WatcherMetadata = {
    last_charge_ts: latestChargeTs,
    fixture_cursor: nextCursor,
    milestones_fired: [...nextMilestonesFired].sort((a, b) => a - b),
    first_sale_fired: nextFirstSaleFired,
  };

  await postState(orchUrl, turnId, {
    stripe_balance_usd: response.balance_usd,
    charges_count: response.count,
    metadata: nextMeta,
  });

  await postMemory(
    orchUrl,
    turnId,
    `projects/${ctx.project_id}/ops/revenue.md`,
    renderRevenueMemory(
      ctx.project_id,
      response.balance_usd,
      response.count,
      response.charges,
      notable,
      nowIso(),
    ),
  );

  await postEvent(orchUrl, turnId, {
    ...base,
    type: "result",
    content: `revenue-watcher tick complete (${response.charges.length} sale${response.charges.length === 1 ? "" : "s"}, balance $${response.balance_usd.toFixed(2)})`,
    ts: nowIso(),
  });
}

main().catch(async (err) => {
  // Never crash cron. Best-effort emit an error event, then exit 0.
  try {
    const orchUrl =
      process.env.ORCH_URL ?? process.env.ORCHESTRATOR_URL ?? "";
    const turnId = process.env.TURN_ID ?? "unknown";
    if (orchUrl) {
      await fetch(`${orchUrl}/internal/turns/${turnId}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_id: "unknown",
          turn: 0,
          agent: AGENT,
          agent_run_id: "unknown",
          type: "error",
          content: `revenue-watcher crashed: ${err instanceof Error ? err.message : String(err)}`,
          ts: new Date().toISOString(),
        }),
      }).catch(() => undefined);
    }
  } catch {
    /* swallow */
  }
  process.exit(0);
});
