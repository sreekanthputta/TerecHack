import { AgentContextSchema, type AgentContext } from "@autobiz/shared";

export async function readContext(): Promise<AgentContext> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) throw new Error("planner: empty stdin — expected AgentContext JSON");
  return AgentContextSchema.parse(JSON.parse(raw));
}
