import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  createExploration,
  createProject,
  getBugDetail,
  getBugs,
  getStatus,
} from "../clients/replay.js";

const CreateBody = z.object({
  project_id: z.string().min(1),
  base_url: z.string().url(),
  design_document: z.string().min(1),
});

const ExplorationBody = z.object({
  regression_notes: z.string().optional(),
});

export async function registerReplayRoutes(app: FastifyInstance) {
  app.post("/replay/project", async (req, reply) => {
    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    try {
      return await createProject(parsed.data);
    } catch (err) {
      req.log.error({ err }, "loop-qa create project failed");
      return reply.code(502).send({ error: "loop-qa upstream failed" });
    }
  });

  app.get<{ Params: { id: string } }>("/replay/project/:id/status", async (req, reply) => {
    try {
      return await getStatus(req.params.id);
    } catch (err) {
      req.log.error({ err }, "loop-qa status failed");
      return reply.code(502).send({ error: "loop-qa upstream failed" });
    }
  });

  app.get<{ Params: { id: string } }>("/replay/project/:id/bugs", async (req, reply) => {
    try {
      return await getBugs(req.params.id);
    } catch (err) {
      req.log.error({ err }, "loop-qa bugs failed");
      return reply.code(502).send({ error: "loop-qa upstream failed" });
    }
  });

  app.get<{ Params: { bug_id: string } }>("/replay/bugs/:bug_id", async (req, reply) => {
    try {
      const detail = await getBugDetail(req.params.bug_id);
      if (!detail) return reply.code(404).send({ error: "bug not found" });
      return detail;
    } catch (err) {
      req.log.error({ err }, "loop-qa bug detail failed");
      return reply.code(502).send({ error: "loop-qa upstream failed" });
    }
  });

  app.post<{ Params: { id: string } }>("/replay/project/:id/explorations", async (req, reply) => {
    const parsed = ExplorationBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body" });
    }
    try {
      return await createExploration(req.params.id, parsed.data.regression_notes);
    } catch (err) {
      req.log.error({ err }, "loop-qa exploration failed");
      return reply.code(502).send({ error: "loop-qa upstream failed" });
    }
  });
}
