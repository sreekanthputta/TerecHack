import type { DecisionRecord } from "@autobiz/shared";
import type { TriggerEvent } from "./trigger.js";

export type NotifyDecision = "skip" | "notify";

/**
 * Decide whether the owner should hear about this. Fire on:
 *   - explicit `metadata.owner_should_know: true` on the trigger, OR
 *   - a reversal (before value differs from after value)
 */
export function shouldNotifyOwner(trigger: TriggerEvent | undefined, decision: DecisionRecord): NotifyDecision {
  const explicit = trigger?.metadata?.owner_should_know === true;
  if (explicit) return "notify";
  if (isReversal(decision)) return "notify";
  return "skip";
}

function isReversal(d: DecisionRecord): boolean {
  const b = JSON.stringify(d.before.value);
  const a = JSON.stringify(d.after.value);
  if (b === a) return false;
  // A confidence bump without a value change is not a reversal.
  return b !== "null" && b !== undefined;
}

export async function notifyOwner(
  intUrl: string,
  payload: { project_id: string; message: string; requires_approval?: boolean },
): Promise<void> {
  const res = await fetch(`${intUrl}/linq/notify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`linq/notify failed: ${res.status} ${await res.text()}`);
}
