import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createProduct } from "../clients/shopify.js";
import { isPluginConnected } from "../plugins.js";

const ProductBody = z.object({
  title: z.string().min(1),
  description_html: z.string().optional(),
  price_usd: z.number().positive(),
  images: z.array(z.string().url()).optional(),
  vendor: z.string().optional(),
  product_type: z.string().optional(),
});

export async function registerShopifyRoutes(app: FastifyInstance) {
  app.post("/shopify/product", async (req, reply) => {
    if (!isPluginConnected("shopify")) {
      return reply.code(503).send({ error: "shopify plugin not connected" });
    }
    const parsed = ProductBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    try {
      return await createProduct(parsed.data);
    } catch (err) {
      req.log.error({ err }, "shopify create product failed");
      return reply.code(502).send({ error: "shopify upstream failed" });
    }
  });
}
