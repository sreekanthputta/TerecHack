export type Frontmatter = Record<string, string>;

export function parseFrontmatter(source: string): { frontmatter: Frontmatter | null; body: string } {
  if (!source.startsWith("---")) {
    return { frontmatter: null, body: source };
  }
  const rest = source.slice(3);
  const endIdx = rest.indexOf("\n---");
  if (endIdx === -1) return { frontmatter: null, body: source };
  const yaml = rest.slice(0, endIdx).replace(/^\n/, "");
  const body = rest.slice(endIdx + 4).replace(/^\n/, "");
  const frontmatter: Frontmatter = {};
  for (const rawLine of yaml.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }
  return { frontmatter, body };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
  );
  return out;
}

export function renderMarkdown(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];
  let inList = false;
  let inQuote = false;
  let inCode = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      out.push("</blockquote>");
      inQuote = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (inCode) {
      if (line.startsWith("```")) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push(escapeHtml(line));
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushParagraph();
      closeList();
      closeQuote();
      out.push('<pre class="md-pre"><code>');
      inCode = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      flushParagraph();
      closeList();
      closeQuote();
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#{1,6}\s+/, "");
      out.push(`<h${level}>${inline(text)}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      closeList();
      if (!inQuote) {
        out.push("<blockquote>");
        inQuote = true;
      }
      out.push(`<p>${inline(line.replace(/^>\s?/, ""))}</p>`);
      continue;
    } else {
      closeQuote();
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const item = line.replace(/^\s*[-*]\s+/, "");
      out.push(`<li>${inline(item)}</li>`);
      continue;
    } else {
      closeList();
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  closeList();
  closeQuote();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
