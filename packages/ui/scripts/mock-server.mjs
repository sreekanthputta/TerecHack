#!/usr/bin/env node
// Mock orchestrator that replays a fixture trace over SSE.
// Serves the same REST surface described in CONTRACTS.md §2, but purely from a jsonl file.

import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const PORT = Number(process.env.MOCK_PORT ?? 4000);
const FIXTURE = process.env.FIXTURE ?? resolve(REPO, "fixtures/traces/demo-3dprint.jsonl");
const REPLAY_INTERVAL_MS = Number(process.env.REPLAY_INTERVAL_MS ?? 1800);

function loadEvents() {
  const raw = readFileSync(FIXTURE, "utf8").split("\n").filter(Boolean);
  return raw.map((line) => JSON.parse(line));
}

const events = loadEvents();
const projectId = events[0]?.project_id ?? "01HXDEMO00000000000000000";
const now = new Date();

const businessState = {
  project_id: projectId,
  status: "live",
  turn: events.at(-1)?.turn ?? 0,
  idea: "3D printer sitting idle — make me money.",
  owner_contact: "sreekanth@example.com",
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
  stripe_balance_cents: 0,
  plan_version: 1,
  active_agents: ["planner", "researcher"],
  memory_file_count: 6,
  uptime_percent: 100,
  elapsed_seconds: 42,
  domain: "cablecraft.example.com",
};

const decisions = [
  {
    id: "dec_1",
    project_id: projectId,
    turn: 1,
    kind: "pivot",
    reason: "researcher found $12 CPC on '3D printer parts' — swapping to accessories niche.",
    before: { title: "Print-on-demand vertical", conf: 0.55 },
    after: { title: "Cable-tidy 3D printed accessories", conf: 0.82 },
    ts: new Date(now.getTime() - 60_000).toISOString(),
    agent: "planner",
    agent_run_id: "00000000-0000-4000-8000-000000000001",
  },
];

const memoryFiles = [
  {
    path: "planner/plan.md",
    size: 512,
    updated_at: now.toISOString(),
    agent: "planner",
    content: "---\nname: plan\ntype: project\n---\n\n# Plan v2\n\n- Ship cable-tidy landing\n- Verify with Terac\n- Publish 3 SKUs\n",
  },
  {
    path: "researcher/keywords.md",
    size: 340,
    updated_at: now.toISOString(),
    agent: "researcher",
    content: "# Keywords\n\n- cable tidy 3d printed\n- desk cable management\n- cable clip stl\n",
  },
];

const plugins = [
  {
    id: "stripe",
    name: "Stripe",
    tier: "required",
    purpose: "Payment links, balance polling, webhook signatures.",
    used_by: ["builder", "revenue-watcher"],
    fields: [
      { key: "secret_key", label: "Secret key", placeholder: "sk_live_...", secret: true, required: true },
      { key: "webhook_secret", label: "Webhook signing secret", placeholder: "whsec_...", secret: true, required: false },
    ],
  },
  {
    id: "terac",
    name: "Terac",
    tier: "required",
    purpose: "Real-human validation loop. Ships with your workspace.",
    used_by: ["verifier"],
    fields: [
      { key: "org_token", label: "Panel org token", placeholder: "panel_org_...", secret: true, required: true },
    ],
  },
  {
    id: "shopify",
    name: "Shopify",
    tier: "recommended",
    purpose: "List real products, sync inventory, publish variants.",
    used_by: ["builder", "researcher"],
    fields: [
      { key: "shop_domain", label: "Shop domain", placeholder: "yourshop.myshopify.com", secret: false, required: true },
      { key: "admin_token", label: "Admin API access token", placeholder: "shpat_...", secret: true, required: true },
      { key: "storefront_token", label: "Storefront access token", placeholder: "Optional", secret: true, required: false },
    ],
    scopes: ["write_products", "read_products", "write_inventory", "read_orders"],
  },
  {
    id: "render",
    name: "Render",
    tier: "recommended",
    purpose: "Static site deploys with custom domains and rollbacks.",
    used_by: ["builder", "service-watcher"],
    fields: [{ key: "api_key", label: "API key", placeholder: "rnd_...", secret: true, required: true }],
  },
  {
    id: "linq",
    name: "Linq (iMessage)",
    tier: "recommended",
    purpose: "Owner alerts on decisions, sales, and outages.",
    used_by: ["verifier", "revenue-watcher", "service-watcher"],
    fields: [{ key: "api_key", label: "API key", placeholder: "linq_...", secret: true, required: true }],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    tier: "recommended",
    purpose: "Bring your own Claude key.",
    used_by: ["planner", "researcher", "builder", "verifier"],
    fields: [{ key: "api_key", label: "API key", placeholder: "sk-ant-...", secret: true, required: true }],
  },
  {
    id: "superserve",
    name: "Superserve",
    tier: "recommended",
    purpose: "Isolated browser sessions for scraping and Replay QA.",
    used_by: ["researcher", "replay-qa"],
    fields: [{ key: "api_key", label: "API key", placeholder: "ss_...", secret: true, required: true }],
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    tier: "recommended",
    purpose: "Auto-point custom domains, manage TLS, cache landing pages.",
    used_by: ["builder", "service-watcher"],
    fields: [
      { key: "account_id", label: "Account ID", placeholder: "abc123...", secret: false, required: true },
      { key: "api_token", label: "API token", placeholder: "cf_...", secret: true, required: true },
    ],
  },
  {
    id: "ga4",
    name: "Google Analytics",
    tier: "optional",
    purpose: "Landing page traffic + funnel analytics.",
    used_by: ["revenue-watcher"],
    fields: [{ key: "measurement_id", label: "Measurement ID", placeholder: "G-XXXXXXX", secret: false, required: true }],
  },
  {
    id: "etsy",
    name: "Etsy Research",
    tier: "optional",
    purpose: "Trend + keyword research on Etsy.",
    used_by: ["researcher"],
    fields: [{ key: "api_key", label: "API key", placeholder: "etsy_...", secret: true, required: true }],
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    tier: "optional",
    purpose: "SMS alerts fallback for iMessage-less phones.",
    used_by: ["service-watcher"],
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC...", secret: true, required: true },
      { key: "auth_token", label: "Auth token", placeholder: "...", secret: true, required: true },
    ],
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    tier: "optional",
    purpose: "Transactional email delivery.",
    used_by: ["revenue-watcher"],
    fields: [{ key: "api_key", label: "API key", placeholder: "SG...", secret: true, required: true }],
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    tier: "optional",
    purpose: "Launch paid campaigns from Builder.",
    used_by: ["builder"],
    fields: [{ key: "access_token", label: "Access token", placeholder: "EAAG...", secret: true, required: true }],
  },
  {
    id: "amazon",
    name: "Amazon Seller",
    tier: "optional",
    purpose: "Publish product listings to Amazon.",
    used_by: ["builder"],
    fields: [{ key: "refresh_token", label: "SP-API refresh token", placeholder: "Atzr|...", secret: true, required: true }],
  },
  {
    id: "replay",
    name: "Replay QA",
    tier: "optional",
    purpose: "Automated deterministic browser replays.",
    used_by: ["replay-qa"],
    fields: [{ key: "api_key", label: "API key", placeholder: "rp_...", secret: true, required: true }],
  },
];

/** id → config */
const pluginConfigs = new Map();
pluginConfigs.set("stripe", { id: "stripe", connected: true, masked_preview: { secret_key: "sk_live_••••4Fx2" } });
pluginConfigs.set("terac", { id: "terac", connected: true, masked_preview: { org_token: "panel_org_••••k2f" } });
pluginConfigs.set("render", { id: "render", connected: true, masked_preview: { api_key: "rnd_••••a71" } });
pluginConfigs.set("linq", { id: "linq", connected: true, masked_preview: { api_key: "linq_••••92e" } });
pluginConfigs.set("anthropic", { id: "anthropic", connected: true, masked_preview: { api_key: "sk-ant-••••Kx4" } });
pluginConfigs.set("superserve", { id: "superserve", connected: true, masked_preview: { api_key: "ss_••••7bc" } });

const pendingMessages = [];

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Last-Event-ID");
  res.setHeader("Access-Control-Expose-Headers", "Last-Event-ID");
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function eventsSince(since) {
  const cutoff = Number.isFinite(since) ? since : 0;
  return events.filter((e) => e.id > cutoff);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname;

    if (path === "/api/businesses") return json(res, 200, [businessState]);
    if (path === `/api/business/${projectId}`) return json(res, 200, businessState);

    if (path === "/api/business" && req.method === "POST") {
      const body = await readBody(req);
      console.log("[mock] POST /api/business idea:", body.idea?.slice(0, 60));
      return json(res, 200, { project_id: projectId });
    }

    if (path === `/api/business/${projectId}/events`) {
      const since = Number(url.searchParams.get("since") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 200);
      return json(res, 200, eventsSince(since).slice(0, limit));
    }

    if (path === `/api/business/${projectId}/decisions`) return json(res, 200, decisions);
    if (path === `/api/business/${projectId}/memory`) return json(res, 200, { files: memoryFiles });

    if (path === `/api/business/${projectId}/message` && req.method === "POST") {
      const body = await readBody(req);
      const nextTurn = businessState.turn + 1;
      pendingMessages.push({ content: body.content, turn: nextTurn, ts: new Date().toISOString() });
      console.log(`[mock] queued pivot for turn ${nextTurn}: ${body.content?.slice(0, 60)}`);
      return json(res, 200, { queued_for_turn: nextTurn });
    }

    if (path === `/api/business/${projectId}/stream`) {
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const lastId = Number(req.headers["last-event-id"] ?? 0);
      const backlog = eventsSince(lastId);
      let cursor = 0;
      for (const e of backlog) {
        res.write(`id: ${e.id}\nevent: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
        cursor = e.id;
      }
      // Loop the tail forever with fresh ids so demo feels alive.
      let nextId = events.at(-1).id;
      const interval = setInterval(() => {
        nextId += 1;
        const rotate = events[cursor % events.length];
        const synthesized = {
          ...rotate,
          id: nextId,
          ts: new Date().toISOString(),
        };
        res.write(`id: ${synthesized.id}\nevent: ${synthesized.type}\ndata: ${JSON.stringify(synthesized)}\n\n`);
        cursor += 1;
      }, REPLAY_INTERVAL_MS);
      req.on("close", () => clearInterval(interval));
      return;
    }

    if (path === "/api/plugins") return json(res, 200, plugins);
    if (path === "/api/plugins/config") return json(res, 200, [...pluginConfigs.values()]);

    const cfgMatch = path.match(/^\/api\/plugins\/([^/]+)\/config$/);
    if (cfgMatch) {
      const id = cfgMatch[1];
      const descriptor = plugins.find((p) => p.id === id);
      if (!descriptor) return json(res, 404, { error: "unknown plugin" });
      if (req.method === "PUT") {
        const body = await readBody(req);
        const preview = {};
        for (const f of descriptor.fields) {
          const v = String(body[f.key] ?? "");
          if (!v) continue;
          preview[f.key] = f.secret ? `${v.slice(0, 4)}${"•".repeat(6)}${v.slice(-3)}` : v;
        }
        const cfg = {
          id,
          connected: true,
          masked_preview: preview,
          connected_at: new Date().toISOString(),
        };
        pluginConfigs.set(id, cfg);
        return json(res, 200, cfg);
      }
      if (req.method === "DELETE") {
        pluginConfigs.delete(id);
        cors(res);
        res.writeHead(204);
        res.end();
        return;
      }
    }

    if (path === "/health") return json(res, 200, { ok: true });

    cors(res);
    res.writeHead(404);
    res.end();
  } catch (e) {
    console.error("[mock] error", e);
    json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

server.listen(PORT, () => {
  console.log(`[mock] listening on http://localhost:${PORT}`);
  console.log(`[mock] project: ${projectId} · fixture: ${FIXTURE} · ${events.length} events`);
});
