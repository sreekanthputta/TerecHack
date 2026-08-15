import type { TraceEvent } from "@autobiz/shared";

/**
 * In-memory pub/sub keyed by project_id. Subscribers get every event as it
 * lands via insertEvent(). Backpressure: if a subscriber throws, we drop it.
 */
export type Subscriber = (ev: TraceEvent) => void;

class ProjectBus {
  private subs = new Map<string, Set<Subscriber>>();

  subscribe(project_id: string, sub: Subscriber): () => void {
    let set = this.subs.get(project_id);
    if (!set) {
      set = new Set();
      this.subs.set(project_id, set);
    }
    set.add(sub);
    return () => this.unsubscribe(project_id, sub);
  }

  unsubscribe(project_id: string, sub: Subscriber): void {
    const set = this.subs.get(project_id);
    if (!set) return;
    set.delete(sub);
    if (set.size === 0) this.subs.delete(project_id);
  }

  publish(ev: TraceEvent): void {
    const set = this.subs.get(ev.project_id);
    if (!set) return;
    for (const sub of Array.from(set)) {
      try {
        sub(ev);
      } catch {
        set.delete(sub);
      }
    }
  }

  subscriberCount(project_id: string): number {
    return this.subs.get(project_id)?.size ?? 0;
  }
}

export const bus = new ProjectBus();

export function formatSseFrame(ev: TraceEvent): string {
  return `id: ${ev.id}\nevent: trace\ndata: ${JSON.stringify(ev)}\n\n`;
}

export function heartbeat(): string {
  return `: ping\n\n`;
}
