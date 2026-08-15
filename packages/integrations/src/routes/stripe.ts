import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import {
  createFixturePaymentLink,
  createRealPaymentLink,
  getFixtureCharges,
  getRealCharges,
  refuseIfLiveSecret,
} from "../clients/stripe-client.js";

const PaymentLinkBody = z.object({
  project_id: z.string().min(1),
  product_name: z.string().min(1),
  amount_usd: z.number().positive().optional(),
});

export async function registerStripeRoutes(app: FastifyInstance) {
  app.post("/stripe/payment-link", async (req, reply) => {
    const parsed = PaymentLinkBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    try {
      refuseIfLiveSecret();
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
    try {
      return env.FIXTURE_MODE
        ? createFixturePaymentLink(parsed.data)
        : await createRealPaymentLink(parsed.data);
    } catch (err) {
      req.log.error({ err }, "stripe payment-link failed");
      return reply.code(502).send({ error: "stripe upstream failed" });
    }
  });

  app.get<{ Params: { project_id: string }; Querystring: { since?: string } }>(
    "/stripe/charges/:project_id",
    async (req, reply) => {
      const { project_id } = req.params;
      const { since } = req.query;
      try {
        return env.FIXTURE_MODE
          ? getFixtureCharges(project_id, since)
          : await getRealCharges(project_id, since);
      } catch (err) {
        req.log.error({ err, project_id }, "stripe charges failed");
        return reply.code(502).send({ error: "stripe upstream failed" });
      }
    },
  );
}
