import pino from "pino";
import { env } from "./env.js";

const SECRET_KEY_HINTS = [
  "TERAC_API_KEY",
  "STRIPE_RESTRICTED_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "RENDER_API_KEY",
  "LINQ_API_KEY",
  "LINQ_WEBHOOK_SECRET",
  "SUPERSERVE_API_KEY",
  "REPLAY_API_KEY",
  "SHOPIFY_ADMIN_TOKEN",
  "ANTHROPIC_API_KEY",
  "authorization",
  "cookie",
  "set-cookie",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      ...SECRET_KEY_HINTS.map((k) => `*.${k}`),
      ...SECRET_KEY_HINTS.map((k) => `*.headers.${k.toLowerCase()}`),
      "headers.authorization",
      "headers.cookie",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
    remove: false,
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
