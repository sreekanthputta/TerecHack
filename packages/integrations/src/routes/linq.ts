import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import {
  eventToPivotMessage,
  forwardToOrchestrator,
  notifyFixture,
  notifyReal,
  verifyLinqSignature,
} from "../clients/linq.js";

const NotifyBody = z.object({
  project_id: z.string().min(1),
  message: z.string().min(1),
  requires_approval: z.boolean().optional(),
});

const WebhookBody = z.object({
  event: z.enum(["tapback", "reply"]),
  project_id: z.string().optional(),
  action: z.enum(["approve", "reject"]).optional(),
  text: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function registerLinqRoutes(app: FastifyInstance) {
  app.post("/linq/notify", async (req, reply) => {
    const parsed = NotifyBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid body", issues: parsed.error.issues });
    }
    try {
      return env.FIXTURE_MODE ? notifyFixture(parsed.data) : await notifyReal(parsed.data);
    } catch (err) {
      req.log.error({ err }, "linq notify failed");
      return reply.code(502).send({ error: "linq upstream failed" });
    }
  });

  // Raw body needed for signature verification.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      try {
        const parsed = body.length ? JSON.parse(body as string) : {};
        (parsed as { __raw?: string }).__raw = body as string;
        done(null, parsed);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.post("/linq/webhook", async (req, reply) => {
    const body = (req.body ?? {}) as { __raw?: string; [k: string]: unknown };
    const raw = body.__raw ?? "";
    const signature =
      (req.headers["x-linq-signature"] as string | undefined) ??
      (req.headers["x-signature"] as string | undefined);
    if (!verifyLinqSignature(raw, signature)) {
      return reply.code(401).send({ error: "bad signature" });
    }
    const parsed = WebhookBody.safeParse(body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid webhook body" });
    }
    const pivot = eventToPivotMessage(parsed.data);
    if (!pivot) return { ok: true, forwarded: false };
    try {
      await forwardToOrchestrator(pivot.project_id, pivot.content);
      return { ok: true, forwarded: true };
    } catch (err) {
      req.log.warn({ err, project_id: pivot.project_id }, "linq webhook forward failed");
      return reply.code(202).send({ ok: true, forwarded: false });
    }
  });
}
