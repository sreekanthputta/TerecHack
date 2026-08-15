import { z } from "zod";
import { AgentNameSchema } from "./agents.js";

export const PluginIdSchema = z.enum([
  "terac",
  "stripe",
  "anthropic",
  "render",
  "linq",
  "superserve",
  "replay",
  "shopify",
  "cloudflare",
  "twilio",
  "sendgrid",
  "ga4",
  "etsy",
  "meta_ads",
  "amazon",
]);

export type PluginId = z.infer<typeof PluginIdSchema>;

export const PluginTierSchema = z.enum(["required", "recommended", "optional"]);
export type PluginTier = z.infer<typeof PluginTierSchema>;

export const PluginFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  placeholder: z.string(),
  secret: z.boolean(),
  required: z.boolean(),
});

export type PluginField = z.infer<typeof PluginFieldSchema>;

export const PluginDescriptorSchema = z.object({
  id: PluginIdSchema,
  name: z.string().min(1),
  tier: PluginTierSchema,
  purpose: z.string().min(1),
  used_by: z.array(AgentNameSchema),
  fields: z.array(PluginFieldSchema),
  scopes: z.array(z.string()).optional(),
});

export type PluginDescriptor = z.infer<typeof PluginDescriptorSchema>;

export const PluginConfigSchema = z.object({
  id: PluginIdSchema,
  connected: z.boolean(),
  masked_preview: z.record(z.string()),
  connected_at: z.string().datetime().optional(),
});

export type PluginConfig = z.infer<typeof PluginConfigSchema>;
