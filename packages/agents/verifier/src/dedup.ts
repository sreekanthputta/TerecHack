import type { AgentContext } from "@autobiz/shared";

/**
 * Look for `decisions/*.md` files listed in memory.project. If any of the last
 * few file paths mentions the same topic slug, we treat this as an already-
 * answered question and skip the Terac call.
 *
 * We keep this deliberately shallow: filenames only, no content fetch. The
 * orchestrator lists project memory when it hands us the context.
 */
export function shouldDedup(ctx: AgentContext, topic: string, lookback = 3): boolean {
  const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return false;
  const decisions = ctx.memory.project.filter((p) => /decisions\/.+\.md$/i.test(p));
  const recent = decisions.slice(-lookback);
  return recent.some((p) => p.toLowerCase().includes(slug));
}
