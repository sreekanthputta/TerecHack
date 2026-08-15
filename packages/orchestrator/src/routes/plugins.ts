import type { FastifyInstance } from "fastify";
import { PluginIdSchema } from "@autobiz/shared";
import { z } from "zod";
import type { Ctx } from "../app.js";
import { PLUGIN_CATALOG, getPluginDescriptor } from "../plugins/catalog.js";
import { deletePluginConfig, listPluginConfigs, storePluginConfig } from "../plugins/service.js";

const PutConfigSchema = z.object({
  fields: z.record(z.string(), z.string()),
});

export async function registerPluginRoutes(app: FastifyInstance, ctx: Ctx): Promise<void> {
  app.get("/api/plugins", async () => PLUGIN_CATALOG);

  app.get("/api/plugins/config", async () => listPluginConfigs(ctx.repo));

  app.put<{ Params: { id: string } }>("/api/plugins/:id/config", async (req, reply) => {
    const idParsed = PluginIdSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      reply.code(404);
      return { error: "unknown_plugin" };
    }
    const bodyParsed = PutConfigSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      reply.code(400);
      return { error: "invalid_body", detail: bodyParsed.error.flatten() };
    }
    const descriptor = getPluginDescriptor(idParsed.data);
    if (!descriptor) {
      reply.code(404);
      return { error: "unknown_plugin" };
    }
    if (idParsed.data === "stripe") {
      const key = bodyParsed.data.fields.STRIPE_RESTRICTED_KEY ?? "";
      if (key.startsWith("sk_")) {
        reply.code(400);
        return { error: "stripe_requires_rk_key" };
      }
    }
    return storePluginConfig(ctx.repo, idParsed.data, bodyParsed.data.fields);
  });

  app.delete<{ Params: { id: string } }>("/api/plugins/:id/config", async (req, reply) => {
    const idParsed = PluginIdSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      reply.code(404);
      return { error: "unknown_plugin" };
    }
    deletePluginConfig(ctx.repo, idParsed.data);
    return { ok: true };
  });
}
