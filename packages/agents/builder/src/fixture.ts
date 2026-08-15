import type { PaymentLink, DeployResult } from "./integrations.js";

export const FIXTURE_PAYMENT_LINK: PaymentLink = {
  url: "https://buy.stripe.com/test_fixture_pl_00001",
  id: "pl_fixture_00001",
};

export function fixtureDeploy(slug: string, version: number): DeployResult {
  return {
    url: `https://${slug}-v${version}.onrender.com`,
    deploy_id: `dep_fixture_${slug}_v${version}`,
  };
}

/**
 * Minimal delay used to keep fixture-mode traces looking alive without adding
 * meaningful latency. Total end-to-end stays well under a second.
 */
export function fixtureDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
