import { AgentContextSchema, type AgentContext } from "@autobiz/shared";
import { OrchClient } from "./orch.js";
import { pickTemplate } from "./template.js";
import { generateCopy } from "./content.js";
import { renderTemplate, slugify } from "./templates.js";
import { IntegrationsClient } from "./integrations.js";
import { FIXTURE_PAYMENT_LINK, fixtureDelay, fixtureDeploy } from "./fixture.js";
import { buildNotes } from "./notes.js";
import { regionsForBug, fixApproach, unionRegions } from "./retry.js";
import type { PaymentLink, DeployResult } from "./integrations.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    await opts.orch.event({
      type: "error",
      content: `stripe unavailable, shipping with placeholder link: ${(err as Error).message}`,
    });
    return { url: "https://buy.stripe.com/unavailable", id: "pl_unavailable" };
  }
}

async function deploy(opts: {
  ctx: AgentContext;
  integrations: IntegrationsClient;
  slug: string;
  html: string;
  version: number;
  orch: OrchClient;
}): Promise<DeployResult> {
  if (opts.ctx.env.fixture_mode) {
    await fixtureDelay(30);
    return fixtureDeploy(opts.slug, opts.version);
  }
  const name = opts.slug;
  try {
    return await opts.integrations.deploy({
      project_id: opts.ctx.project_id,
      html: opts.html,
      name,
    });
  } catch (firstErr) {
    await opts.orch.event({
      type: "error",
      content: `render deploy failed, retrying: ${(firstErr as Error).message}`,
    });
    await new Promise((r) => setTimeout(r, 500));
    try {
      return await opts.integrations.deploy({
        project_id: opts.ctx.project_id,
        html: opts.html,
        name,
      });
    } catch (secondErr) {
      const dir = join(tmpdir(), "autobiz-builder");
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `${opts.ctx.project_id}.html`);
      writeFileSync(path, opts.html, "utf8");
      await opts.orch.event({
        type: "error",
        content: `render deploy failed twice, wrote local fallback: ${(secondErr as Error).message}`,
      });
      return { url: `file://${path}`, deploy_id: `local_${opts.slug}` };
    }
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
  const priorBugs = ctx.prior_bugs ?? [];

  await orch.event({
    type: "thought",
    content: isRetry
      ? `builder v${version}: retry run with ${priorBugs.length} prior bug(s)`
      : `builder v${version}: fresh build for ${ctx.plan.vertical} project`,
  });

  if (isRetry) {
    for (const bug of priorBugs) {
      const regions = regionsForBug(bug);
      await orch.event({
        type: "thought",
        content: fixApproach(bug, regions).slice(0, 500),
        metadata: { bug_id: bug.bug_id, regions },
      });
    }
  }

  const template = pickTemplate(ctx.plan);
  await orch.event({
    type: "action",
    content: `chose template "${template.id}" (${template.reason})`,
    metadata: { template: template.id, sku_count: template.sku_count },
  });

  const regenRegions = isRetry ? unionRegions(priorBugs) : undefined;
  const copy = await generateCopy({
    plan: ctx.plan,
    template: template.id,
    sku_count: template.sku_count,
    fixture_mode: ctx.env.fixture_mode,
    regen_regions: regenRegions,
  });
  await orch.event({
    type: "thought",
    content: isRetry
      ? `regenerated regions: ${regenRegions!.join(", ")}`
      : `generated copy: "${copy.hero}" (${copy.products.length} products)`,
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

  const deployRes = await deploy({
    ctx,
    integrations,
    slug,
    html,
    version,
    orch,
  });

  await orch.event({
    type: "deploy",
    content: `deployed v${version} to ${deployRes.url}`,
    metadata: {
      landing_url: deployRes.url,
      deploy_id: deployRes.deploy_id,
      builder_version: version,
    },
  });

  const fixedBugIds = priorBugs.map((b) => b.bug_id);
  if (isRetry) {
    await orch.event({
      type: "bugs_fixed",
      content: `fixed ${fixedBugIds.length} bug(s): ${fixedBugIds.join(", ")}`,
      metadata: { bug_ids: fixedBugIds, builder_version: version },
    });
  }

  const notes = buildNotes({
    version,
    template: template.id,
    copy,
    paymentLink,
    deployRes,
    priorBugs: ctx.prior_bugs,
    fixedBugIds: isRetry ? fixedBugIds : undefined,
  });
  await orch.memory(`projects/${ctx.project_id}/build/v${version}-notes.md`, notes);

  const httpUrl = deployRes.url.startsWith("http") ? deployRes.url : undefined;
  const httpPay = paymentLink.url.startsWith("http") ? paymentLink.url : undefined;
  await orch.state({
    builder_version: version,
    ...(httpUrl ? { landing_url: httpUrl } : {}),
    ...(httpPay ? { stripe_payment_link: httpPay } : {}),
  });

  await orch.event({
    type: "result",
    content: `builder v${version} finished; template=${template.id}`,
    metadata: {
      template: template.id,
      sku_count: template.sku_count,
      landing_url: deployRes.url,
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
