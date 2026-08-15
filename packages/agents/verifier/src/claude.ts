import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | undefined;

export function getAnthropic(): Anthropic | undefined {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  if (!cached) cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cached;
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

/**
 * Ask Claude for a JSON object matching a schema. Returns the raw string.
 * Retries once with a schema reminder if the first attempt is not JSON.
 */
export async function askForJson(prompt: string, schemaHint: string): Promise<string | undefined> {
  const client = getAnthropic();
  if (!client) return undefined;

  const systemPreamble = `You reply with a single JSON object and nothing else. Schema:\n${schemaHint}`;
  const attempt = async (extra?: string) => {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPreamble,
      messages: [{ role: "user", content: extra ? `${prompt}\n\n${extra}` : prompt }],
    });
    const text = res.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return extractJson(text);
  };

  const first = await attempt();
  if (first) return first;
  return await attempt(`Reminder: reply with ONLY a JSON object matching this schema:\n${schemaHint}`);
}

function extractJson(text: string): string | undefined {
  if (!text) return undefined;
  // Strip ```json fences if present.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return undefined;
  const slice = candidate.slice(start, end + 1);
  try {
    JSON.parse(slice);
    return slice;
  } catch {
    return undefined;
  }
}
