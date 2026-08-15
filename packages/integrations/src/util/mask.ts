/**
 * Return a display-safe preview of a secret: prefix + `••••` + last-4.
 * Never returns more than 4 real characters (the last 4) of the input.
 */
export function maskLast4(value: string | undefined | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  const prefixMatch = trimmed.match(/^([a-zA-Z]+_(?:live_|test_)?)/);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  const last4 = trimmed.slice(-4);
  return `${prefix}••••${last4}`;
}
