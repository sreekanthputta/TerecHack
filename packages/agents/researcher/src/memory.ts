import type { ResearchSource } from "./schemas.js";

const MAX_CHARS = 2000;

export type MemoryNote = { path: string; content: string };

export function noteForSource(src: ResearchSource, project_id: string): MemoryNote {
  const frontmatter = [
    "---",
    `type: research`,
    `slug: ${src.slug}`,
    `project_id: ${project_id}`,
    `source_url: ${src.url}`,
    `title: ${JSON.stringify(src.title)}`,
    `captured_at: ${new Date().toISOString()}`,
    "---",
    "",
  ].join("\n");
  const body = [
    `# ${src.title}`,
    "",
    "## Summary",
    src.summary,
    "",
    "## Evidence",
    src.evidence,
  ].join("\n");
  const raw = frontmatter + body;
  const content = raw.length <= MAX_CHARS ? raw : `${raw.slice(0, MAX_CHARS - 1)}…`;
  return { path: `research/${src.slug}.md`, content };
}
