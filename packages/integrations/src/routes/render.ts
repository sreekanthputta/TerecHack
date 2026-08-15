import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import {
  deployFixture,
  deployReal,
  healthFixture,
  healthReal,
  logsFixture,
  logsReal,
} from "../clients/render.js";

const DeployBody = z.object({
  project_id: z.string().min(1),
  html: z.string(),
  name: z.string().min(1),
});

export async function registerRenderRoutes(app: FastifyInstance) {
  app.post("/render/deploy", async (req, reply) => {
    const parsed = DeployBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    return env.FIXTURE_MODE
      ? deployFixture(parsed.data)
      : deployReal(parsed.data);
  });

  app.get<{ Params: { project_id: string } }>("/render/health/:project_id", async (req) => {
    return env.FIXTURE_MODE
      ? healthFixture(req.params.project_id)
      : healthReal(req.params.project_id);
  });

  app.get<{
    Params: { project_id: string };
    Querystring: { since?: string; limit?: string };
  }>("/render/logs/:project_id", async (req) => {
    const limit = req.query.limit ? Math.min(200, Math.max(1, Number(req.query.limit))) : 50;
    return env.FIXTURE_MODE
      ? logsFixture(req.params.project_id, req.query.since, limit)
      : logsReal(req.params.project_id, req.query.since, limit);
  });
}
