import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

/**
 * Memory tree lives on disk at <repo_root>/memory/. All writes are validated
 * to stay within the calling project's tree (or a specific whitelisted path).
 * Frontmatter is a "---" fenced YAML-ish block; we accept whatever comes in
 * and just parse it lazily for the /memory endpoint.
 */

export type MemoryFile = {
  path: string;                // relative path from memory root, e.g. "projects/<id>/plan.md"
  frontmatter: Record<string, unknown>;
  body: string;
  bytes: number;
  updated_at: string;
};

function memoryRoot(): string {
  return resolve(process.cwd(), "memory");
}

export function ensureMemoryRoot(): string {
  const root = memoryRoot();
  mkdirSync(join(root, "workspace"), { recursive: true });
  mkdirSync(join(root, "projects"), { recursive: true });
  return root;
}

export function projectDir(project_id: string): string {
  return join(memoryRoot(), "projects", project_id);
}

export function writeProjectMemory(project_id: string, relPath: string, content: string): string {
  ensureMemoryRoot();
  const projRoot = projectDir(project_id);
  const target = resolve(projRoot, relPath);
  const normProj = resolve(projRoot);
  if (!(target === normProj || target.startsWith(normProj + sep))) {
    throw new Error(`memory write escapes project tree: ${relPath}`);
  }
  if (!target.endsWith(".md")) {
    throw new Error(`memory writes must be .md files: ${relPath}`);
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, "utf8");
  return relative(memoryRoot(), target);
}

const FRONT_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = FRONT_RE.exec(raw);
  if (!m) return { frontmatter: {}, body: raw };
  const fm: Record<string, unknown> = {};
  for (const line of m[1]!.split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    let v: string = line.slice(idx + 1).trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      fm[k] = v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
      continue;
    }
    if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    fm[k] = v;
  }
  return { frontmatter: fm, body: m[2] ?? "" };
}

export function listProjectMemory(project_id: string): MemoryFile[] {
  const root = memoryRoot();
  const dir = projectDir(project_id);
  if (!existsSync(dir)) return [];

  const files: MemoryFile[] = [];
  const walk = (p: string) => {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const abs = join(p, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.name.endsWith(".md")) continue;
      const raw = readFileSync(abs, "utf8");
      const stat = statSync(abs);
      const { frontmatter, body } = parseFrontmatter(raw);
      files.push({
        path: relative(root, abs),
        frontmatter,
        body,
        bytes: stat.size,
        updated_at: stat.mtime.toISOString(),
      });
    }
  };
  walk(dir);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

export function listMemoryPathsForContext(project_id: string): { workspace: string[]; project: string[] } {
  const root = memoryRoot();
  ensureMemoryRoot();
  const collect = (dir: string): string[] => {
    if (!existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...collect(abs));
      else if (entry.name.endsWith(".md")) out.push(relative(root, abs));
    }
    return out;
  };
  return {
    workspace: collect(join(root, "workspace")),
    project: collect(projectDir(project_id)),
  };
}
