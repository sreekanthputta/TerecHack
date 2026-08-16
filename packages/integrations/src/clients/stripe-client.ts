import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { readJson, writeJson } from "../util/state.js";
import { maskLast4 } from "../util/mask.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARGES_FIXTURE = resolve(
  __dirname,
  "..",
  "..",
  "fixtures",
  "stripe",
  "charges.jsonl",
);

const STATE_FILE = "stripe.json";

export type StripeStateFile = {
  projects: Record<
    string,
    { payment_link_id: string; url: string; product_id: string; created_at: string }
  >;
};

function loadState(): StripeStateFile {
  return readJson<StripeStateFile>(STATE_FILE, { projects: {} });
}

function saveState(state: StripeStateFile): void {
  writeJson(STATE_FILE, state);
}

export function refuseIfLiveSecret(): void {
  if (env.STRIPE_RESTRICTED_KEY.startsWith("sk_")) {
    throw new Error(
      "STRIPE_RESTRICTED_KEY starts with 'sk_' — restricted rk_ keys only",
    );
  }
}

let stripeInstance: Stripe | null = null;
function getStripe(): Stripe {
  refuseIfLiveSecret();
  if (!env.STRIPE_RESTRICTED_KEY)
    throw new Error("STRIPE_RESTRICTED_KEY not set");
  if (!stripeInstance)
    stripeInstance = new Stripe(env.STRIPE_RESTRICTED_KEY);
  return stripeInstance;
}

export type CreatePaymentLinkInput = {
  project_id: string;
  product_name: string;
  amount_usd?: number;
};

export type PaymentLinkResult = { url: string; id: string };

export function createFixturePaymentLink(
  input: CreatePaymentLinkInput,
): PaymentLinkResult {
  const state = loadState();
  const existing = state.projects[input.project_id];
  if (existing) return { url: existing.url, id: existing.payment_link_id };
  const slug = input.product_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const id = `plink_fx_${slug || input.project_id.slice(0, 6)}`;
  const url = `https://buy.stripe.com/test_demo/${slug || id}`;
  state.projects[input.project_id] = {
    payment_link_id: id,
    url,
    product_id: `prod_fx_${slug}`,
    created_at: new Date().toISOString(),
  };
  saveState(state);
  return { url, id };
}

export async function createRealPaymentLink(
  input: CreatePaymentLinkInput,
): Promise<PaymentLinkResult> {
  refuseIfLiveSecret();
  const state = loadState();
  const existing = state.projects[input.project_id];
  if (existing) return { url: existing.url, id: existing.payment_link_id };

  try {
    const stripe = getStripe();
    const product = await stripe.products.create({ name: input.product_name });

    const priceParams: Stripe.PriceCreateParams =
      input.amount_usd !== undefined
        ? {
            currency: env.STRIPE_CURRENCY,
            unit_amount: Math.round(input.amount_usd * 100),
            product: product.id,
          }
        : {
            currency: env.STRIPE_CURRENCY,
            custom_unit_amount: { enabled: true },
            product: product.id,
          };
    const price = await stripe.prices.create(priceParams);

    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: input.amount_usd === undefined ? 1 : 1,
          adjustable_quantity:
            input.amount_usd === undefined ? undefined : { enabled: true, maximum: 5 },
        },
      ],
      metadata: { project_id: input.project_id },
    });

    state.projects[input.project_id] = {
      payment_link_id: link.id,
      url: link.url,
      product_id: product.id,
      created_at: new Date().toISOString(),
    };
    saveState(state);

    logger.info(
      { project_id: input.project_id, id: link.id, key: maskLast4(env.STRIPE_RESTRICTED_KEY) },
      "stripe payment link created",
    );
    return { url: link.url, id: link.id };
  } catch (err) {
    // Real link creation needs the rk_ key to have Products + Prices + Payment
    // Links write. If any is missing, degrade to a fixture link so the demo's
    // QR/checkout still renders instead of 502-ing.
    logger.warn(
      { err, project_id: input.project_id, key: maskLast4(env.STRIPE_RESTRICTED_KEY) },
      "stripe real payment-link failed; using fixture link (grant rk key Products/Prices/PaymentLinks write to go real)",
    );
    return createFixturePaymentLink(input);
  }
}

export type ChargeItem = {
  id: string;
  amount_usd: number;
  ts: string;
  product: string;
  status: string;
};

export type ChargesResult = {
  charges: ChargeItem[];
  balance_usd: number;
  count: number;
};

export function getFixtureCharges(
  project_id: string,
  since?: string,
): ChargesResult {
  const state = loadState();
  const link = state.projects[project_id];
  if (!existsSync(CHARGES_FIXTURE)) {
    return { charges: [], balance_usd: 0, count: 0 };
  }
  const cutoff = since ? Date.parse(since) : 0;
  const lines = readFileSync(CHARGES_FIXTURE, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const linkId = link?.payment_link_id ?? "plink_fx_demo";
  const charges: ChargeItem[] = [];
  for (const line of lines) {
    let row: {
      id: string;
      amount_usd: number;
      ts: string;
      product: string;
      status: string;
      payment_link_id?: string;
    };
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.payment_link_id && row.payment_link_id !== linkId && link) continue;
    if (Date.parse(row.ts) <= cutoff) continue;
    charges.push({
      id: row.id,
      amount_usd: row.amount_usd,
      ts: row.ts,
      product: row.product,
      status: row.status,
    });
  }
  const balance_usd = charges
    .filter((c) => c.status === "succeeded")
    .reduce((s, c) => s + c.amount_usd, 0);
  return { charges, balance_usd, count: charges.length };
}

export async function getRealCharges(
  project_id: string,
  since?: string,
): Promise<ChargesResult> {
  refuseIfLiveSecret();
  const state = loadState();
  const link = state.projects[project_id];
  if (!link) return { charges: [], balance_usd: 0, count: 0 };
  const stripe = getStripe();
  const params: Stripe.ChargeListParams = { limit: 100 };
  if (since) {
    params.created = { gt: Math.floor(Date.parse(since) / 1000) };
  }
  const list = await stripe.charges.list(params);
  const relevant = list.data.filter(
    (c) => c.payment_intent && (c.metadata?.project_id === project_id ||
      (typeof c.payment_intent === "object" && c.payment_intent.metadata?.project_id === project_id)),
  );
  const charges: ChargeItem[] = relevant.map((c) => ({
    id: c.id,
    amount_usd: c.amount / 100,
    ts: new Date(c.created * 1000).toISOString(),
    product: c.description ?? "",
    status: c.status,
  }));
  const balance_usd = charges
    .filter((c) => c.status === "succeeded")
    .reduce((s, c) => s + c.amount_usd, 0);
  return { charges, balance_usd, count: charges.length };
}

export function getStripeProjectIds(): string[] {
  return Object.keys(loadState().projects);
}
