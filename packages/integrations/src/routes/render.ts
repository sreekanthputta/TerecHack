import type { FastifyInstance } from "fastify";

export async function registerRenderRoutes(app: FastifyInstance) {
  app.post("/render/deploy", async () => ({
    url: "https://stub.onrender.com",
    deploy_id: "dep_stub",
  }));
  app.get("/render/health/:project_id", async () => ({
    status: "healthy",
    latency_ms: 42,
    checked_at: new Date().toISOString(),
  }));
  app.get("/render/logs/:project_id", async () => ({ lines: [] }));
}
