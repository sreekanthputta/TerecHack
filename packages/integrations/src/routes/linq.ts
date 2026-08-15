import type { FastifyInstance } from "fastify";

export async function registerLinqRoutes(app: FastifyInstance) {
  app.post("/linq/notify", async () => ({ sid: "lq_stub" }));
  app.post("/linq/webhook", async () => ({ ok: true }));
}
