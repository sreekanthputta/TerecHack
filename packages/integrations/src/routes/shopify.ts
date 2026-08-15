import type { FastifyInstance } from "fastify";

export async function registerShopifyRoutes(app: FastifyInstance) {
  app.post("/shopify/product", async (_req, reply) =>
    reply.code(503).send({ error: "shopify plugin not connected" }),
  );
}
