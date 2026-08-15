/**
 * Central env module. Reads process.env once at boot with sensible defaults
 * that match .env.example. Refuses to boot on obvious misconfigurations.
 */

function bool(v: string | undefined, dflt = false): boolean {
  if (v === undefined) return dflt;
  return v === "1" || v.toLowerCase() === "true";
}

function num(v: string | undefined, dflt: number): number {
  if (v === undefined || v === "") return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export type Env = ReturnType<typeof loadEnv>;

export function loadEnv() {
  const stripeKey = process.env.STRIPE_RESTRICTED_KEY ?? "";
  if (stripeKey.startsWith("sk_")) {
    console.error(
      "Orchestrator refuses to boot: STRIPE_RESTRICTED_KEY starts with 'sk_'. Use a restricted rk_ key.",
    );
    process.exit(1);
  }

  const encryptionKey = process.env.ENCRYPTION_KEY ?? "";
  const encryptionKeyOk = /^[0-9a-fA-F]{64}$/.test(encryptionKey);

  return {
    node_env: process.env.NODE_ENV ?? "development",
    log_level: process.env.LOG_LEVEL ?? "info",

    orch_port: num(process.env.ORCH_PORT ?? process.env.PORT, 4000),
    integrations_url: process.env.INTEGRATIONS_URL ?? `http://localhost:${num(process.env.INTEGRATIONS_PORT, 4100)}`,
    orchestrator_url: process.env.ORCHESTRATOR_URL ?? `http://localhost:${num(process.env.ORCH_PORT ?? process.env.PORT, 4000)}`,

    database_url: process.env.DATABASE_URL ?? "file:./autobiz.db",
    encryption_key: encryptionKey,
    encryption_key_ok: encryptionKeyOk,
    nextauth_secret: process.env.NEXTAUTH_SECRET ?? "change_me",

    stripe_restricted_key: stripeKey,

    fixture_mode: bool(process.env.FIXTURE_MODE, false),
    demo_settings_mode: bool(process.env.DEMO_SETTINGS_MODE, false),
    demo_owner_name: process.env.DEMO_OWNER_NAME ?? "Owner",
    demo_owner_email: process.env.DEMO_OWNER_EMAIL ?? "owner@example.com",

    repo_root: process.env.REPO_ROOT ?? "",
  } as const;
}

export const env = loadEnv();
