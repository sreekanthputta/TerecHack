import "dotenv/config";

const truthy = (v: string | undefined): boolean =>
  v === "true" || v === "1" || v === "yes";

const num = (v: string | undefined, fallback: number): number => {
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  FIXTURE_MODE: truthy(process.env.FIXTURE_MODE),

  INTEGRATIONS_PORT: num(
    process.env.INTEGRATIONS_PORT ?? process.env.PORT,
    4100,
  ),
  ORCH_PORT: num(process.env.ORCH_PORT, 4000),
  UI_PORT: num(process.env.UI_PORT, 3000),

  NEXT_PUBLIC_APP_URL:
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ORCH_URL:
    process.env.ORCH_URL ?? `http://localhost:${num(process.env.ORCH_PORT, 4000)}`,

  // Terac
  TERAC_API_KEY: process.env.TERAC_API_KEY ?? "",
  TERAC_ORG_ID: process.env.TERAC_ORG_ID ?? "",
  TERAC_PROJECT_ID: process.env.TERAC_PROJECT_ID ?? "",
  TERAC_PANEL_URL: process.env.TERAC_PANEL_URL ?? "https://terac.com/api/external/v2",
  TERAC_DEFAULT_SAMPLE_SIZE: num(process.env.TERAC_DEFAULT_SAMPLE_SIZE, 15),
  TERAC_DEFAULT_TIMEOUT_SEC: num(process.env.TERAC_DEFAULT_TIMEOUT_SEC, 180),

  // Stripe
  STRIPE_RESTRICTED_KEY: process.env.STRIPE_RESTRICTED_KEY ?? "",
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  STRIPE_CURRENCY: process.env.STRIPE_CURRENCY ?? "usd",

  // Render
  RENDER_API_KEY: process.env.RENDER_API_KEY ?? "",
  RENDER_OWNER_ID: process.env.RENDER_OWNER_ID ?? "",
  RENDER_REGION: process.env.RENDER_REGION ?? "oregon",
  // Real git-backed static site: generated storefronts are pushed here and
  // served per-project at <URL>/p/<project_id>/. Autodeploys on commit.
  RENDER_STATIC_SITE_URL:
    process.env.RENDER_STATIC_SITE_URL ?? "https://autobusiness-wagm.onrender.com",
  RENDER_STATIC_PUBLISH_DIR: process.env.RENDER_STATIC_PUBLISH_DIR ?? "sites",
  RENDER_DEPLOY_BRANCH: process.env.RENDER_DEPLOY_BRANCH ?? "main",

  // Linq
  LINQ_API_KEY: process.env.LINQ_API_KEY ?? "",
  LINQ_OWNER_PHONE: process.env.LINQ_OWNER_PHONE ?? "",
  LINQ_OWNER_NAME: process.env.LINQ_OWNER_NAME ?? "",
  LINQ_FROM_NUMBER: process.env.LINQ_FROM_NUMBER ?? "",
  LINQ_WEBHOOK_SECRET: process.env.LINQ_WEBHOOK_SECRET ?? "",

  // Superserve
  SUPERSERVE_API_KEY: process.env.SUPERSERVE_API_KEY ?? "",
  SUPERSERVE_POOL_SIZE: num(process.env.SUPERSERVE_POOL_SIZE, 3),
  SUPERSERVE_SESSION_TTL_SEC: num(process.env.SUPERSERVE_SESSION_TTL_SEC, 600),

  // Loop QA (Replay)
  REPLAY_API_KEY: process.env.REPLAY_API_KEY ?? "",
  REPLAY_BASE_URL:
    process.env.REPLAY_BASE_URL ?? "https://qa.replay.io/api/v1",

  // Shopify
  SHOPIFY_SHOP_DOMAIN: process.env.SHOPIFY_SHOP_DOMAIN ?? "",
  SHOPIFY_ADMIN_TOKEN: process.env.SHOPIFY_ADMIN_TOKEN ?? "",
};

export type Env = typeof env;

/**
 * Boot-time validation: refuse to start if a *live secret* key is used where a
 * restricted one is required. Called from the server entrypoint.
 */
export function assertBootSafety(): void {
  if (env.STRIPE_RESTRICTED_KEY.startsWith("sk_")) {
    throw new Error(
      "Refusing to boot: STRIPE_RESTRICTED_KEY starts with 'sk_'. Use a restricted rk_ key.",
    );
  }
  if (!env.FIXTURE_MODE && env.REPLAY_API_KEY === "") {
    throw new Error(
      "Refusing to boot: REPLAY_API_KEY unset and FIXTURE_MODE != 'true'. Set REPLAY_API_KEY (lqa_...) or enable FIXTURE_MODE.",
    );
  }
}
