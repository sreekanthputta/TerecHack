import type { FastifyInstance } from "fastify";
import { TeracAskSchema } from "@autobiz/shared";
import { env } from "../env.js";
import {
  createFixtureAsk,
  createRealAsk,
  getFixtureResult,
  getRealResult,
} from "../clients/terac.js";

export async function registerTeracRoutes(app: FastifyInstance) {
  app.post("/terac/ask", async (req, reply) => {
    const parsed = TeracAskSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid TeracAsk", issues: parsed.error.issues });
    }
    if (env.FIXTURE_MODE) return createFixtureAsk(parsed.data);
    try {
      return await createRealAsk(parsed.data);
    } catch (err) {
      req.log.error({ err }, "terac ask failed");
      return reply.code(502).send({ error: "terac upstream failed" });
    }
  });

  app.get<{ Params: { ask_id: string } }>("/terac/result/:ask_id", async (req, reply) => {
    const { ask_id } = req.params;
    try {
      const out = env.FIXTURE_MODE ? getFixtureResult(ask_id) : await getRealResult(ask_id);
      if (out.pending) return reply.code(202).send({ pending: true });
      return out.response;
    } catch (err) {
      req.log.error({ err, ask_id }, "terac result failed");
      return reply.code(502).send({ error: "terac upstream failed" });
    }
  });
}
