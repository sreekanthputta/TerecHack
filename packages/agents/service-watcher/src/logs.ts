export type LogCluster = {
  kind: "5xx" | "exception" | "redirect_loop" | "rate_limit";
  endpoint: string;
  count: number;
  example: string;
};

const HTTP_5XX = /\b(5\d{2})\b/;
const METHOD_PATH = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)/;
const EXCEPTION = /(Uncaught|Unhandled|Error:|TypeError|ReferenceError|panic:|stack trace)/i;
const REDIRECT = /\b30[12]\b/;
const RATE_LIMIT = /(429|rate.?limit|too many requests)/i;

function endpointOf(line: string): string {
  const m = line.match(METHOD_PATH);
  return m ? `${m[1]} ${m[2]}` : "unknown";
}

function bumpCluster(map: Map<string, LogCluster>, key: string, base: Omit<LogCluster, "count">) {
  const cur = map.get(key);
  if (cur) {
    cur.count += 1;
  } else {
    map.set(key, { ...base, count: 1 });
  }
}

/**
 * Group log lines into anomaly clusters. Each cluster keys on kind+endpoint so
 * one endpoint firing many 5xx becomes a single cluster with a `count`.
 */
export function scan(lines: string[]): LogCluster[] {
  const clusters = new Map<string, LogCluster>();
  const redirectSequence = new Map<string, number>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const endpoint = endpointOf(line);

    const m5xx = line.match(HTTP_5XX);
    if (m5xx && Number(m5xx[1]) >= 500) {
      bumpCluster(clusters, `5xx|${endpoint}`, {
        kind: "5xx",
        endpoint,
        example: line.slice(0, 200),
      });
    }

    if (EXCEPTION.test(line)) {
      bumpCluster(clusters, `exception|${endpoint}`, {
        kind: "exception",
        endpoint,
        example: line.slice(0, 200),
      });
    }

    if (RATE_LIMIT.test(line)) {
      bumpCluster(clusters, `rate_limit|${endpoint}`, {
        kind: "rate_limit",
        endpoint,
        example: line.slice(0, 200),
      });
    }

    if (REDIRECT.test(line)) {
      const n = (redirectSequence.get(endpoint) ?? 0) + 1;
      redirectSequence.set(endpoint, n);
      if (n >= 2) {
        bumpCluster(clusters, `redirect_loop|${endpoint}`, {
          kind: "redirect_loop",
          endpoint,
          example: line.slice(0, 200),
        });
      }
    } else {
      redirectSequence.set(endpoint, 0);
    }
  }

  return [...clusters.values()].sort((a, b) => b.count - a.count);
}

export function totalErrors(clusters: LogCluster[]): number {
  return clusters
    .filter((c) => c.kind === "5xx" || c.kind === "exception")
    .reduce((acc, c) => acc + c.count, 0);
}
