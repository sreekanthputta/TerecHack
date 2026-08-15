import Anthropic from "@anthropic-ai/sdk";
import { BusinessPlanSchema, type BusinessPlan } from "@autobiz/shared";

const DEFAULT_MODEL = "claude-sonnet-4-6";

export type LlmInput = {
  ownerIdea: string;
  learnedPatterns: string[];
  priorPlan: BusinessPlan | null;
  pivotMessages: string[];
  projectId: string;
  version: number;
  ownerContact: BusinessPlan["owner_contact"];
};

export type LlmResult =
  | { ok: true; plan: BusinessPlan; reasoning: string[] }
  | { ok: false; error: string };

function buildSystemPrompt(): string {
  return [
    "You are the PLANNER agent for AutoBusiness (Zero Human Company).",
    "You read an owner's one-line idea (and optional pivot messages) and output a BusinessPlan JSON.",
    "You do NOT do research or call integrations. You only sketch structure — Researcher/Verifier will validate.",
    "Keep the plan short, decisive, and revenue-focused. Prefer print-on-demand or landing-page verticals when unclear.",
    "The `agents` array must include roles chosen from: researcher, verifier, builder, replay-qa, revenue-watcher, service-watcher.",
    "Every non-trivial project needs at minimum: researcher, verifier, builder, replay-qa, revenue-watcher, service-watcher.",
    "Emit reasoning as short bullets in the `reasoning` array (each <400 chars).",
    "Output MUST be a single JSON object matching this shape:",
    JSON.stringify({
      reasoning: ["string bullets"],
      plan: {
        project_id: "string (echo back)",
        version: 1,
        goal: "string — one sentence, close to owner's words",
        vertical: "string — e.g. print-on-demand, landing-page, delivery-site",
        agents: [{ role: "researcher", task: "one sentence" }],
        budget_usd: 200,
        terac_studies_planned: [{ topic: "string", audience: "general", when: "before-build" }],
        owner_contact: { channel: "imessage", address: "string" },
      },
      thin_bets: {
        vertical: 0.7,
        budget: 0.8,
      },
    }),
    "Return ONLY the JSON. No prose before or after.",
  ].join("\n");
}

function buildUserPrompt(inp: LlmInput): string {
  const parts: string[] = [];
  parts.push(`Project ID: ${inp.projectId}`);
  parts.push(`Plan version to produce: ${inp.version}`);
  parts.push(`Owner idea: ${inp.ownerIdea}`);
  parts.push(`Owner contact: ${inp.ownerContact.channel} — ${inp.ownerContact.address}`);
  if (inp.learnedPatterns.length > 0) {
    parts.push("");
    parts.push("Learned patterns from workspace memory:");
    for (const p of inp.learnedPatterns) parts.push(`- ${p}`);
  }
  if (inp.priorPlan) {
    parts.push("");
    parts.push(`Prior plan v${inp.priorPlan.version} (vertical=${inp.priorPlan.vertical}, goal=${inp.priorPlan.goal}).`);
  }
  if (inp.pivotMessages.length > 0) {
    parts.push("");
    parts.push("Pivot messages absorbed at this turn boundary:");
    for (const m of inp.pivotMessages) parts.push(`- ${m}`);
    parts.push("");
    parts.push("Explain the change in reasoning, then produce v(n+1) that reflects the new intent.");
  }
  parts.push("");
  parts.push("Now output the JSON.");
  return parts.join("\n");
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(trimmed.slice(start, end + 1));
}

type LlmRawShape = {
  reasoning?: unknown;
  plan?: unknown;
  thin_bets?: unknown;
};

function parsePlan(raw: unknown, inp: LlmInput): { plan: BusinessPlan; reasoning: string[]; thinBets: Record<string, number> } {
  if (!raw || typeof raw !== "object") throw new Error("model output not an object");
  const obj = raw as LlmRawShape;
  const reasoning = Array.isArray(obj.reasoning) ? obj.reasoning.filter((r): r is string => typeof r === "string") : [];
  const thinBets: Record<string, number> =
    obj.thin_bets && typeof obj.thin_bets === "object"
      ? Object.fromEntries(
          Object.entries(obj.thin_bets as Record<string, unknown>).filter(
            (e): e is [string, number] => typeof e[1] === "number",
          ),
        )
      : {};

  const candidate = obj.plan as Record<string, unknown> | undefined;
  if (!candidate) throw new Error("model output missing plan");

  // Force project_id, version, owner_contact to authoritative values.
  const forced = {
    ...candidate,
    project_id: inp.projectId,
    version: inp.version,
    owner_contact: inp.ownerContact,
  };
  const plan = BusinessPlanSchema.parse(forced);
  return { plan, reasoning, thinBets };
}

export async function callPlanner(inp: LlmInput): Promise<LlmResult & { thinBets?: Record<string, number> }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY not set" };
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const system = buildSystemPrompt();
  const user = buildUserPrompt(inp);

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
      });
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const json = extractJson(text);
      const { plan, reasoning, thinBets } = parsePlan(json, inp);
      return { ok: true, plan, reasoning, thinBets };
    } catch (err) {
      lastErr = err;
    }
  }
  return { ok: false, error: lastErr instanceof Error ? lastErr.message : String(lastErr) };
}
