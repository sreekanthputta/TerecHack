/**
 * Standalone demo: boots the integrations server on a free port in FIXTURE_MODE
 * and exercises every provider endpoint. Prints "OK" per provider or "FAIL".
 * Exits non-zero if anything fails.
 */
import { buildApp } from "./server.js";

const PORT = Number(process.env.INTEGRATIONS_PORT ?? 4100);
const BASE = `http://127.0.0.1:${PORT}`;

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function get(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`);
}

async function del(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, { method: "DELETE" });
}

type Check = { name: string; run: () => Promise<void> };

const projectId = `demo-${Date.now().toString(36)}`;

const checks: Check[] = [
  {
    name: "terac",
    run: async () => {
      const ask = await post("/terac/ask", {
        project_id: projectId,
        question: "Would you buy a $25 3D-printed cable organizer?",
        audience: "general",
        target_responses: 5,
        why_asking: "demo",
      });
      const askBody = (await ask.json()) as { ask_id?: string };
      if (!ask.ok || !askBody.ask_id) throw new Error(`ask ${ask.status}`);
      const pend = await get(`/terac/result/${askBody.ask_id}`);
      if (pend.status !== 202) throw new Error(`expected 202 pending, got ${pend.status}`);
    },
  },
  {
    name: "stripe",
    run: async () => {
      const link = await post("/stripe/payment-link", {
        project_id: projectId,
        product_name: "Cable Organizer 3-pack",
        amount_usd: 25,
      });
      const body = (await link.json()) as { url?: string; id?: string };
      if (!link.ok || !body.url?.startsWith("https://")) throw new Error(`link ${link.status}`);
      const charges = await get(`/stripe/charges/${projectId}`);
      if (!charges.ok) throw new Error(`charges ${charges.status}`);
    },
  },
  {
    name: "render",
    run: async () => {
      const deploy = await post("/render/deploy", {
        project_id: projectId,
        html: "<html><body>demo</body></html>",
        name: `autobiz-${projectId}`,
      });
      if (!deploy.ok) throw new Error(`deploy ${deploy.status}`);
      const health = await get(`/render/health/${projectId}`);
      if (!health.ok) throw new Error(`health ${health.status}`);
      const logs = await get(`/render/logs/${projectId}?limit=5`);
      if (!logs.ok) throw new Error(`logs ${logs.status}`);
    },
  },
  {
    name: "linq",
    run: async () => {
      const notify = await post("/linq/notify", {
        project_id: projectId,
        message: "Ship v1?",
        requires_approval: true,
      });
      if (!notify.ok) throw new Error(`notify ${notify.status}`);
    },
  },
  {
    name: "superserve",
    run: async () => {
      const session = await post("/superserve/session", { ttl_sec: 300 });
      const body = (await session.json()) as { session_id?: string };
      if (!session.ok || !body.session_id) throw new Error(`session ${session.status}`);
      const rel = await del(`/superserve/session/${body.session_id}`);
      if (!rel.ok) throw new Error(`release ${rel.status}`);
    },
  },
  {
    name: "replay",
    run: async () => {
      const create = await post("/replay/project", {
        project_id: projectId,
        base_url: "https://demo.onrender.com",
        design_document: "# Demo design",
      });
      const body = (await create.json()) as { id?: string };
      if (!create.ok || !body.id) throw new Error(`create ${create.status}`);
      const status = await get(`/replay/project/${body.id}/status`);
      if (!status.ok) throw new Error(`status ${status.status}`);
      const bugs = await get(`/replay/project/${body.id}/bugs`);
      if (!bugs.ok) throw new Error(`bugs ${bugs.status}`);
    },
  },
  {
    name: "shopify",
    run: async () => {
      const res = await post("/shopify/product", {
        title: "Cable Organizer 3-pack",
        price_usd: 25,
      });
      // In fixture mode the plugin registry treats shopify as connected.
      if (!res.ok) throw new Error(`product ${res.status}`);
    },
  },
];

async function main() {
  const app = await buildApp();
  await app.listen({ port: PORT, host: "127.0.0.1" });

  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`${check.name.padEnd(12)} `);
    try {
      await check.run();
      console.log("OK");
    } catch (err) {
      failed++;
      console.log("FAIL", (err as Error).message);
    }
  }
  await app.close();
  if (failed > 0) {
    console.error(`${failed} provider(s) failed`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
