import type { FastifyInstance } from "fastify";

export async function registerTeracRoutes(app: FastifyInstance) {
  app.post("/terac/ask", async () => ({ ask_id: "fixture-stub" }));
  app.get("/terac/result/:ask_id", async (_req, reply) =>
    reply.code(202).send({ pending: true }),
  );
}
