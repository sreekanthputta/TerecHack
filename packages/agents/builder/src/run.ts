import { AgentContextSchema, type AgentContext } from "@autobiz/shared";
import { OrchClient } from "./orch.js";
import { pickTemplate } from "./template.js";
import { generateCopy } from "./content.js";
import { renderTemplate, slugify } from "./templates.js";
import { IntegrationsClient } from "./integrations.js";
import { FIXTURE_PAYMENT_LINK, fixtureDelay, fixtureDeploy } from "./fixture.js";
import type { PaymentLink } from "./integrations.js";

const AGENT = "builder" as const;

async function createPaymentLink(opts: {
  ctx: AgentContext;
  integrations: IntegrationsClient;
  productName: string;
  amountUsd?: number;
  orch: OrchClient;
}): Promise<PaymentLink> {
  if (opts.ctx.env.fixture_mode) {
    await fixtureDelay(20);
    return FIXTURE_PAYMENT_LINK;
  }
  try {
    return await opts.integrations.createPaymentLink({
      project_id: opts.ctx.project_id,
      product_name: opts.productName,
      amount_usd: opts.amountUsd,
    });
  } catch (err) {
    const fallback = process.env.STRIPE_DEMO_PAYMENT_LINK;
    if (fallback) {
      await opts.orch.event({
        type: "error",
        content: `stripe failed, using STRIPE_DEMO_PAYMENT_LINK fallback: ${(err as Error).message}`,
      });
      return { url: fallback, id: "pl_demo_fallback" };
    }
    throw err;
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function detectVersion(ctx: AgentContext): { version: number; isRetry: boolean } {
  const bugs = ctx.prior_bugs ?? [];
  return { version: bugs.length > 0 ? 2 : 1, isRetry: bugs.length > 0 };
}

async function main() {
  const raw = await readStdin();
  const ctx = AgentContextSchema.parse(JSON.parse(raw));
  const orch = new OrchClient(ctx.env.orchestrator_url, ctx.turn_id, {
    project_id: ctx.project_id,
    turn: ctx.turn,
    agent: AGENT,
    agent_run_id: ctx.agent_run_id,
  });

  const { version, isRetry } = detectVersion(ctx);

  await orch.event({
    type: "thought",
    content: isRetry
      ? `builder v${version}: retry run with ${ctx.prior_bugs!.length} prior bug(s)`
      : `builder v${version}: fresh build for ${ctx.plan.vertical} project`,
  });

  const template = pickTemplate(ctx.plan);
  await orch.event({
    type: "action",
    content: `chose template "${template.id}" (${template.reason})`,
    metadata: { template: template.id, sku_count: template.sku_count },
  });

  const copy = await generateCopy({
    plan: ctx.plan,
    template: template.id,
    sku_count: template.sku_count,
    fixture_mode: ctx.env.fixture_mode,
  });
  await orch.event({
    type: "thought",
    content: `generated copy: "${copy.hero}" (${copy.products.length} products)`,
  });

  const slug = slugify(`${copy.brand_name}-${ctx.project_id}`);
  const integrations = new IntegrationsClient(ctx.env.integrations_url);

  const paymentLink = await createPaymentLink({
    ctx,
    integrations,
    productName: copy.products[0]?.name ?? copy.brand_name,
    amountUsd: copy.products[0]?.price_usd,
    orch,
  });
  await orch.event({
    type: "action",
    content: `stripe payment link ready (${paymentLink.id})`,
    metadata: { payment_url: paymentLink.url, payment_link_id: paymentLink.id },
  });

  const html = renderTemplate({
    template: template.id,
    copy,
    slug,
    payment_url: paymentLink.url,
  });
  await orch.event({
    type: "action",
    content: `rendered ${html.length} bytes of HTML`,
    metadata: { bytes: html.length, template: template.id },
  });

  await orch.event({
    type: "result",
    content: `builder v${version} finished; template=${template.id}`,
    metadata: {
      template: template.id,
      sku_count: template.sku_count,
      landing_url: paymentLink.url,
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
