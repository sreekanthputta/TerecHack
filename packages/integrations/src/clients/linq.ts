import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env.js";
import { logger } from "../logger.js";
import { maskLast4 } from "../util/mask.js";

export type NotifyInput = {
  project_id: string;
  message: string;
  requires_approval?: boolean;
};

export type NotifyResult = { sid: string };

const LINQ_ENDPOINT = "https://api.linq.dev/v1/messages";

export async function notifyReal(input: NotifyInput): Promise<NotifyResult> {
  if (!env.LINQ_API_KEY) throw new Error("LINQ_API_KEY not set");
  const payload = input.requires_approval
    ? {
        to: env.LINQ_OWNER_PHONE,
        recipient_name: env.LINQ_OWNER_NAME,
        // iMessage App interactive card — tapback 👍/👎 replies to the webhook
        type: "imessage.app_card",
        card: {
          title: `AutoBusiness · ${input.project_id}`,
          body: input.message,
          actions: [
            { id: "approve", label: "👍 Approve", tapback: "up" },
            { id: "reject", label: "👎 Reject", tapback: "down" },
          ],
          metadata: {
            project_id: input.project_id,
            requires_approval: true,
          },
        },
      }
    : {
        to: env.LINQ_OWNER_PHONE,
        recipient_name: env.LINQ_OWNER_NAME,
        type: "imessage.text",
        text: input.message,
        metadata: { project_id: input.project_id },
      };

  const res = await fetch(LINQ_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.LINQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`linq notify failed ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { sid?: string; id?: string };
  const sid = data.sid ?? data.id;
  if (!sid) throw new Error("linq response missing sid");
  logger.info(
    { project_id: input.project_id, sid, key: maskLast4(env.LINQ_API_KEY) },
    "linq notify sent",
  );
  return { sid };
}

export function notifyFixture(input: NotifyInput): NotifyResult {
  const sid = `sm_fx_${Math.random().toString(36).slice(2, 10)}`;
  logger.info(
    {
      project_id: input.project_id,
      requires_approval: input.requires_approval ?? false,
      sid,
      preview: input.message.slice(0, 80),
    },
    "linq notify (fixture)",
  );
  return { sid };
}

export function verifyLinqSignature(raw: string, signatureHeader: string | undefined): boolean {
  if (!env.LINQ_WEBHOOK_SECRET) return env.FIXTURE_MODE;
  if (!signatureHeader) return false;
  const expected = createHmac("sha256", env.LINQ_WEBHOOK_SECRET).update(raw).digest("hex");
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export type LinqWebhookEvent = {
  event: "tapback" | "reply";
  project_id?: string;
  action?: "approve" | "reject";
  text?: string;
  metadata?: Record<string, unknown>;
};

export function eventToPivotMessage(evt: LinqWebhookEvent): { project_id: string; content: string } | null {
  const project_id =
    evt.project_id ??
    ((evt.metadata?.project_id as string | undefined) ?? undefined);
  if (!project_id) return null;
  if (evt.event === "tapback") {
    if (evt.action === "approve") return { project_id, content: "owner approved" };
    if (evt.action === "reject") return { project_id, content: "owner rejected" };
  }
  if (evt.event === "reply" && evt.text) {
    return { project_id, content: evt.text };
  }
  return null;
}

export async function forwardToOrchestrator(project_id: string, content: string): Promise<void> {
  const url = `${env.ORCH_URL}/api/business/${encodeURIComponent(project_id)}/message`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`orch forward failed ${res.status}`);
  }
}
