import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acquireSession, releaseSession } from "../clients/superserve.js";

const SessionBody = z.object({ ttl_sec: z.number().int().positive().optional() });

export async function registerSuperserveRoutes(app: FastifyInstance) {
  app.post("/superserve/session", async (req, reply) => {
    const parsed = SessionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    try {
      const s = await acquireSession(parsed.data.ttl_sec);
      return { session_id: s.session_id, browser_ws_url: s.browser_ws_url };
    } catch (err) {
      req.log.error({ err }, "superserve acquire failed");
      return reply.code(502).send({ error: "superserve upstream failed" });
    }
  });

  app.delete<{ Params: { id: string } }>("/superserve/session/:id", async (req) => {
    return await releaseSession(req.params.id);
  });
}
