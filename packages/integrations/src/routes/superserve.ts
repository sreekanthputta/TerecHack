import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { acquireSession, releaseSession, browse, search } from "../clients/superserve.js";

const SessionBody = z.object({ ttl_sec: z.number().int().positive().optional() });
const BrowseBody = z.object({ url: z.string().min(1) });
const SearchBody = z.object({ query: z.string().min(1) });

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

  app.post<{ Params: { id: string } }>("/superserve/session/:id/browse", async (req, reply) => {
    const parsed = BrowseBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid body" });
    return await browse(req.params.id, parsed.data.url);
  });

  app.post<{ Params: { id: string } }>("/superserve/session/:id/search", async (req, reply) => {
    const parsed = SearchBody.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "invalid body" });
    return await search(req.params.id, parsed.data.query);
  });

  app.delete<{ Params: { id: string } }>("/superserve/session/:id", async (req) => {
    return await releaseSession(req.params.id);
  });
}
