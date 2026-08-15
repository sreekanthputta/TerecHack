import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../env.js";

/**
 * AES-256-GCM at rest for plugin secrets. Ciphertext blob is
 * base64({iv, tag, ct}) — a compact JSON envelope. Never returned to UI.
 */

const ALG = "aes-256-gcm";

function key(): Buffer {
  if (!env.encryption_key_ok) {
    throw new Error("ENCRYPTION_KEY missing or not 32 bytes hex (64 hex chars). Cannot encrypt plugin secrets.");
  }
  return Buffer.from(env.encryption_key, "hex");
}

export function encryptFields(fields: Record<string, string>): string {
  const plain = Buffer.from(JSON.stringify(fields), "utf8");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key(), iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.from(
    JSON.stringify({
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ct: enc.toString("base64"),
    }),
    "utf8",
  ).toString("base64");
}

export function decryptFields(envelope: string): Record<string, string> {
  const outer = JSON.parse(Buffer.from(envelope, "base64").toString("utf8")) as {
    iv: string; tag: string; ct: string;
  };
  const decipher = createDecipheriv(ALG, key(), Buffer.from(outer.iv, "base64"));
  decipher.setAuthTag(Buffer.from(outer.tag, "base64"));
  const dec = Buffer.concat([decipher.update(Buffer.from(outer.ct, "base64")), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as Record<string, string>;
}

/**
 * Show last 4 chars of secret with dot padding. Non-secret fields returned verbatim.
 * Empty strings surface as "" — caller decides how to render.
 */
export function maskSecret(value: string): string {
  if (!value) return "";
  const tail = value.slice(-4);
  const head = value.slice(0, Math.min(value.length - 4, 8));
  return `${head}${head ? "_" : ""}••••${tail}`;
}

export function buildMaskedPreview(
  fields: { key: string; secret: boolean }[],
  values: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = values[f.key];
    if (v === undefined || v === "") continue;
    out[f.key] = f.secret ? maskSecret(v) : v;
  }
  return out;
}
