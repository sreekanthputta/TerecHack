import type { FastifyInstance } from "fastify";

export async function registerSuperserveRoutes(app: FastifyInstance) {
  app.post("/superserve/session", async () => ({
    session_id: "ss_stub",
    browser_ws_url: "ws://stub",
  }));
  app.delete("/superserve/session/:id", async () => ({ ok: true }));
}
