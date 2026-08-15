import type { BusinessPlan } from "@autobiz/shared";

type FixtureBody = Omit<BusinessPlan, "project_id" | "version" | "owner_contact">;

const THREE_D_PRINTER: FixtureBody = {
  goal: "3D printer sitting idle — turn it into monthly revenue.",
  vertical: "print-on-demand",
  agents: [
    { role: "researcher", task: "Find trending 3D-printable products on Etsy under $30." },
    { role: "verifier", task: "Validate top niches with Terac maker panel." },
    { role: "builder", task: "Ship a Shopify-lite storefront on Render with 5 SKUs." },
    { role: "replay-qa", task: "AI-QA the storefront before flipping live." },
    { role: "revenue-watcher", task: "Tail Stripe every 30s." },
    { role: "service-watcher", task: "Tail uptime + logs every 60s." },
  ],
  budget_usd: 200,
  terac_studies_planned: [
    { topic: "niche-validation", audience: "expert:makers", when: "before-build" },
    { topic: "pricing", audience: "general", when: "post-mvp" },
  ],
};

const CERAMIC_MUGS: FixtureBody = {
  goal: "Ceramic mug shop — sell drops of small-batch mugs online.",
  vertical: "print-on-demand",
  agents: [
    { role: "researcher", task: "Find best-selling mug designs and price bands on Etsy/Amazon under $40." },
    { role: "verifier", task: "Validate top designs with Terac general shopper panel." },
    { role: "builder", task: "Ship a single-product mug storefront on Render with Stripe checkout." },
    { role: "replay-qa", task: "AI-QA the checkout flow before flipping live." },
    { role: "revenue-watcher", task: "Tail Stripe every 30s." },
    { role: "service-watcher", task: "Tail uptime + logs every 60s." },
  ],
  budget_usd: 150,
  terac_studies_planned: [
    { topic: "design-preference", audience: "general", when: "before-build" },
    { topic: "pricing", audience: "general", when: "post-mvp" },
  ],
};

const GENERIC: FixtureBody = {
  goal: "One-line owner idea → a minimum viable revenue funnel.",
  vertical: "landing-page",
  agents: [
    { role: "researcher", task: "Scan competitors and pricing for the stated niche." },
    { role: "verifier", task: "Validate positioning with Terac general audience." },
    { role: "builder", task: "Ship a one-page landing site on Render with a Stripe payment link." },
    { role: "replay-qa", task: "AI-QA the landing page + checkout before flipping live." },
    { role: "revenue-watcher", task: "Tail Stripe every 30s." },
    { role: "service-watcher", task: "Tail uptime + logs every 60s." },
  ],
  budget_usd: 150,
  terac_studies_planned: [
    { topic: "positioning", audience: "general", when: "before-build" },
    { topic: "pricing", audience: "general", when: "post-mvp" },
  ],
};

export function pickFixture(goal: string): FixtureBody {
  const g = goal.toLowerCase();
  if (/(3d[-\s]?print|printer|filament|maker|3d model)/.test(g)) return THREE_D_PRINTER;
  if (/(mug|ceramic|pottery|drinkware|cup)/.test(g)) return CERAMIC_MUGS;
  return GENERIC;
}

export function fixtureToPlan(
  fixture: FixtureBody,
  overrides: {
    project_id: string;
    version: number;
    goal?: string;
    owner_contact: BusinessPlan["owner_contact"];
  },
): BusinessPlan {
  return {
    ...fixture,
    goal: overrides.goal ?? fixture.goal,
    project_id: overrides.project_id,
    version: overrides.version,
    owner_contact: overrides.owner_contact,
  };
}
