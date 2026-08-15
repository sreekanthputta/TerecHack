import type { FastifyInstance } from "fastify";

export async function registerStripeRoutes(app: FastifyInstance) {
  app.post("/stripe/payment-link", async () => ({
    url: "https://buy.stripe.com/test_stub",
    id: "pl_stub",
  }));
  app.get("/stripe/charges/:project_id", async () => ({
    charges: [],
    balance_usd: 0,
    count: 0,
  }));
}
