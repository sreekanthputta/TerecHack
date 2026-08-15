import type { FastifyInstance } from "fastify";
import type { Ctx } from "../app.js";
import { bus, formatSseFrame, heartbeat } from "../sse/bus.js";

/**
 * GET /api/business/:id/stream — SSE endpoint with Last-Event-ID replay.
 * Every event carries `id: <project_seq>` so clients can resume across drops.
 */
export async function registerSseRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  app.get<{ Params: { id: string } }>("/api/business/:id/stream", async (req, reply) => {
    const project_id = req.params.id;
    const project = ctx.repo.getProject(project_id);
    if (!project) {
      reply.code(404);
      return { error: "not_found" };
    }
    const lastIdHeader = req.headers["last-event-id"];
    const lastEventId = Number(Array.isArray(lastIdHeader) ? lastIdHeader[0] : lastIdHeader ?? "0") || 0;

    // reply.hijack() + raw.writeHead bypasses the @fastify/cors plugin's
    // onSend hook, so CORS headers must be written here or EventSource in
    // the browser rejects the stream. Mirror the plugin's allow-all policy.
    const reqOrigin = req.headers.origin;
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": reqOrigin ?? "*",
      "Access-Control-Allow-Credentials": "true",
      Vary: "Origin",
    });
    reply.hijack();

    const send = (chunk: string): boolean => {
      try {
        return reply.raw.write(chunk);
      } catch {
        return false;
      }
    };

    // Replay history before subscribing
    let replayFrom = lastEventId;
    while (true) {
      const batch = ctx.repo.listEvents(project_id, replayFrom, 500);
      if (batch.length === 0) break;
      for (const ev of batch) {
        send(formatSseFrame(ev));
        replayFrom = ev.id;
      }
    }

    const unsubscribe = bus.subscribe(project_id, (ev) => {
      const ok = send(formatSseFrame(ev));
      if (!ok) {
        cleanup();
      }
    });

    const heartbeatTimer = setInterval(() => {
      const ok = send(heartbeat());
      if (!ok) cleanup();
    }, 15_000);

    const cleanup = (): void => {
      clearInterval(heartbeatTimer);
      unsubscribe();
      try { reply.raw.end(); } catch { /* ignore */ }
    };

    req.raw.on("close", cleanup);
    req.raw.on("error", cleanup);
  });
}
