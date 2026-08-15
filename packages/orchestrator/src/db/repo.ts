import type Database from "better-sqlite3";
import type {
  AgentName,
  BusinessPlan,
  BusinessState,
  BusinessStatePatch,
  DecisionRecord,
  ProjectStatus,
  TraceEvent,
  TraceEventInput,
} from "@autobiz/shared";

export type ProjectRow = {
  id: string;
  workspace_id: string;
  goal: string;
  status: ProjectStatus;
  plan_version: number;
  builder_version: number;
  idempotency_key: string | null;
  started_at: string;
  updated_at: string;
};

export type TurnRow = {
  turn_id: string;
  project_id: string;
  turn: number;
  agent: AgentName;
  agent_run_id: string;
  started_at: string;
  ended_at: string | null;
  status: "running" | "done" | "error";
};

export type MessageRow = {
  id: number;
  project_id: string;
  from_role: string;
  content: string;
  queued_for_turn: number | null;
  absorbed_at: string | null;
  ts: string;
};

export type BugRow = {
  bug_id: string;
  project_id: string;
  builder_version: number;
  severity: "blocker" | "major" | "minor";
  where_: string;
  observed: string;
  expected: string;
  repro_json: string;
  fixed_in_version: number | null;
  ts: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export class Repo {
  constructor(private readonly db: Database.Database) {}

  // ---- Projects ----------------------------------------------------------

  findProjectByIdempotencyKey(key: string, withinHours = 24): ProjectRow | undefined {
    const cutoff = new Date(Date.now() - withinHours * 3600_000).toISOString();
    return this.db
      .prepare<[string, string], ProjectRow>(
        `SELECT * FROM projects WHERE idempotency_key = ? AND started_at >= ?`,
      )
      .get(key, cutoff);
  }

  createProject(row: {
    id: string;
    goal: string;
    idempotency_key: string | null;
  }): ProjectRow {
    const now = nowIso();
    const insert = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO projects (id, workspace_id, goal, status, plan_version, builder_version, idempotency_key, started_at, updated_at)
           VALUES (?, 'default', ?, 'planning', 1, 0, ?, ?, ?)`,
        )
        .run(row.id, row.goal, row.idempotency_key, now, now);
      this.db
        .prepare(
          `INSERT INTO business_state (project_id) VALUES (?)`,
        )
        .run(row.id);
    });
    insert();
    return this.getProject(row.id)!;
  }

  getProject(id: string): ProjectRow | undefined {
    return this.db.prepare<[string], ProjectRow>(`SELECT * FROM projects WHERE id = ?`).get(id);
  }

  listProjects(): ProjectRow[] {
    return this.db
      .prepare<[], ProjectRow>(`SELECT * FROM projects ORDER BY started_at DESC`)
      .all();
  }

  updateProjectStatus(id: string, status: ProjectStatus): void {
    this.db
      .prepare(`UPDATE projects SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, nowIso(), id);
  }

  bumpPlanVersion(id: string, version: number): void {
    this.db
      .prepare(`UPDATE projects SET plan_version = ?, updated_at = ? WHERE id = ?`)
      .run(version, nowIso(), id);
  }

  bumpBuilderVersion(id: string): number {
    const now = nowIso();
    const stmt = this.db.prepare<[string, string], { builder_version: number }>(
      `UPDATE projects SET builder_version = builder_version + 1, updated_at = ? WHERE id = ? RETURNING builder_version`,
    );
    return stmt.get(now, id)!.builder_version;
  }

  // ---- BusinessState -----------------------------------------------------

  getBusinessState(project_id: string): BusinessState | undefined {
    const proj = this.getProject(project_id);
    if (!proj) return undefined;
    const bs = this.db
      .prepare<[string], {
        landing_url: string | null;
        stripe_payment_link: string | null;
        stripe_balance_usd: number;
        charges_count: number;
        uptime_pct: number;
        p95_latency_ms: number;
        errors_last_5m: number;
        decisions_count: number;
        bugs_open: number;
      }>(`SELECT * FROM business_state WHERE project_id = ?`)
      .get(project_id);
    if (!bs) return undefined;
    return {
      project_id,
      goal: proj.goal,
      status: proj.status,
      plan_version: proj.plan_version,
      builder_version: proj.builder_version,
      landing_url: bs.landing_url ?? undefined,
      stripe_payment_link: bs.stripe_payment_link ?? undefined,
      stripe_balance_usd: bs.stripe_balance_usd,
      charges_count: bs.charges_count,
      uptime_pct: bs.uptime_pct,
      p95_latency_ms: bs.p95_latency_ms,
      errors_last_5m: bs.errors_last_5m,
      decisions_count: bs.decisions_count,
      bugs_open: bs.bugs_open,
      started_at: proj.started_at,
      updated_at: proj.updated_at,
    };
  }

  patchBusinessState(project_id: string, patch: BusinessStatePatch): void {
    const cols: string[] = [];
    const vals: unknown[] = [];
    const setNumeric = (col: string, v: number | undefined) => {
      if (v !== undefined) {
        cols.push(`${col} = ?`);
        vals.push(v);
      }
    };
    const setString = (col: string, v: string | undefined) => {
      if (v !== undefined) {
        cols.push(`${col} = ?`);
        vals.push(v);
      }
    };
    setString("landing_url", patch.landing_url);
    setString("stripe_payment_link", patch.stripe_payment_link);
    setNumeric("stripe_balance_usd", patch.stripe_balance_usd);
    setNumeric("charges_count", patch.charges_count);
    setNumeric("uptime_pct", patch.uptime_pct);
    setNumeric("p95_latency_ms", patch.p95_latency_ms);
    setNumeric("errors_last_5m", patch.errors_last_5m);
    setNumeric("decisions_count", patch.decisions_count);
    setNumeric("bugs_open", patch.bugs_open);

    if (cols.length > 0) {
      this.db
        .prepare(`UPDATE business_state SET ${cols.join(", ")} WHERE project_id = ?`)
        .run(...vals, project_id);
    }
    if (patch.status !== undefined || patch.plan_version !== undefined || patch.builder_version !== undefined) {
      const pcols: string[] = [];
      const pvals: unknown[] = [];
      if (patch.status !== undefined) { pcols.push("status = ?"); pvals.push(patch.status); }
      if (patch.plan_version !== undefined) { pcols.push("plan_version = ?"); pvals.push(patch.plan_version); }
      if (patch.builder_version !== undefined) { pcols.push("builder_version = ?"); pvals.push(patch.builder_version); }
      pcols.push("updated_at = ?"); pvals.push(nowIso());
      this.db
        .prepare(`UPDATE projects SET ${pcols.join(", ")} WHERE id = ?`)
        .run(...pvals, project_id);
    }
  }

  incrementDecisions(project_id: string): number {
    const stmt = this.db.prepare<[string], { decisions_count: number }>(
      `UPDATE business_state SET decisions_count = decisions_count + 1 WHERE project_id = ? RETURNING decisions_count`,
    );
    return stmt.get(project_id)!.decisions_count;
  }

  setBugsOpen(project_id: string, count: number): void {
    this.db.prepare(`UPDATE business_state SET bugs_open = ? WHERE project_id = ?`).run(count, project_id);
  }

  // ---- Plans -------------------------------------------------------------

  insertPlan(plan: BusinessPlan): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO plans (project_id, version, json, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(plan.project_id, plan.version, JSON.stringify(plan), nowIso());
  }

  getLatestPlan(project_id: string): BusinessPlan | undefined {
    const row = this.db
      .prepare<[string], { json: string }>(
        `SELECT json FROM plans WHERE project_id = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(project_id);
    return row ? (JSON.parse(row.json) as BusinessPlan) : undefined;
  }

  // ---- Events ------------------------------------------------------------

  insertEvent(input: TraceEventInput): TraceEvent {
    const insert = this.db.transaction((ev: TraceEventInput) => {
      const nextSeq = this.db
        .prepare<[string], { seq: number }>(
          `SELECT COALESCE(MAX(project_seq), 0) + 1 AS seq FROM events WHERE project_id = ?`,
        )
        .get(ev.project_id)!.seq;

      this.db
        .prepare(
          `INSERT INTO events (project_id, project_seq, turn, agent, agent_run_id, type, content, confidence, metadata, ts)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          ev.project_id,
          nextSeq,
          ev.turn,
          ev.agent,
          ev.agent_run_id,
          ev.type,
          ev.content,
          ev.confidence ?? null,
          ev.metadata ? JSON.stringify(ev.metadata) : null,
          ev.ts,
        );

      return { seq: nextSeq };
    });
    const { seq } = insert(input);
    return { ...input, id: seq };
  }

  listEvents(project_id: string, sinceSeq: number, limit: number): TraceEvent[] {
    return this.db
      .prepare<[string, number, number], {
        project_seq: number;
        project_id: string;
        turn: number;
        agent: AgentName;
        agent_run_id: string;
        type: string;
        content: string;
        confidence: number | null;
        metadata: string | null;
        ts: string;
      }>(
        `SELECT project_seq, project_id, turn, agent, agent_run_id, type, content, confidence, metadata, ts
         FROM events WHERE project_id = ? AND project_seq > ?
         ORDER BY project_seq ASC LIMIT ?`,
      )
      .all(project_id, sinceSeq, limit)
      .map((r) => ({
        id: r.project_seq,
        project_id: r.project_id,
        turn: r.turn,
        agent: r.agent,
        agent_run_id: r.agent_run_id,
        type: r.type as TraceEvent["type"],
        content: r.content,
        ts: r.ts,
        ...(r.confidence !== null ? { confidence: r.confidence } : {}),
        ...(r.metadata ? { metadata: JSON.parse(r.metadata) as Record<string, unknown> } : {}),
      }));
  }

  // ---- Decisions ---------------------------------------------------------

  insertDecision(d: DecisionRecord): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO decisions (decision_id, project_id, topic, before_json, after_json, aggregate, terac_ask_id, ts)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.decision_id,
        d.project_id,
        d.topic,
        JSON.stringify(d.before),
        JSON.stringify(d.after),
        d.aggregate,
        d.terac_ask_id ?? null,
        d.ts,
      );
  }

  listDecisions(project_id: string): DecisionRecord[] {
    return this.db
      .prepare<[string], {
        decision_id: string;
        project_id: string;
        topic: string;
        before_json: string;
        after_json: string;
        aggregate: string;
        terac_ask_id: string | null;
        ts: string;
      }>(
        `SELECT * FROM decisions WHERE project_id = ? ORDER BY ts ASC`,
      )
      .all(project_id)
      .map((r) => ({
        decision_id: r.decision_id,
        project_id: r.project_id,
        topic: r.topic,
        before: JSON.parse(r.before_json) as DecisionRecord["before"],
        after: JSON.parse(r.after_json) as DecisionRecord["after"],
        aggregate: r.aggregate,
        ...(r.terac_ask_id ? { terac_ask_id: r.terac_ask_id } : {}),
        ts: r.ts,
      }));
  }

  // ---- Bugs --------------------------------------------------------------

  insertBugs(project_id: string, builder_version: number, bugs: Array<{
    bug_id: string; severity: "blocker" | "major" | "minor";
    where: string; observed: string; expected: string; repro: string[];
  }>, ts: string): void {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO bugs (bug_id, project_id, builder_version, severity, where_, observed, expected, repro_json, fixed_in_version, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    );
    const tx = this.db.transaction(() => {
      for (const b of bugs) {
        stmt.run(b.bug_id, project_id, builder_version, b.severity, b.where, b.observed, b.expected, JSON.stringify(b.repro), ts);
      }
    });
    tx();
  }

  countOpenBugs(project_id: string): number {
    return this.db
      .prepare<[string], { c: number }>(
        `SELECT COUNT(*) AS c FROM bugs WHERE project_id = ? AND fixed_in_version IS NULL`,
      )
      .get(project_id)!.c;
  }

  listOpenBugs(project_id: string): BugRow[] {
    return this.db
      .prepare<[string], BugRow>(
        `SELECT * FROM bugs WHERE project_id = ? AND fixed_in_version IS NULL ORDER BY ts ASC`,
      )
      .all(project_id);
  }

  markBugsFixed(project_id: string, fixed_in_version: number): void {
    this.db
      .prepare(`UPDATE bugs SET fixed_in_version = ? WHERE project_id = ? AND fixed_in_version IS NULL`)
      .run(fixed_in_version, project_id);
  }

  // ---- Messages ----------------------------------------------------------

  insertMessage(project_id: string, content: string): MessageRow {
    const info = this.db
      .prepare(`INSERT INTO messages (project_id, from_role, content, queued_for_turn, absorbed_at, ts) VALUES (?, 'owner', ?, NULL, NULL, ?)`)
      .run(project_id, content, nowIso());
    return this.db
      .prepare<[number], MessageRow>(`SELECT * FROM messages WHERE id = ?`)
      .get(info.lastInsertRowid as number)!;
  }

  listQueuedMessages(project_id: string): MessageRow[] {
    return this.db
      .prepare<[string], MessageRow>(
        `SELECT * FROM messages WHERE project_id = ? AND queued_for_turn IS NULL ORDER BY id ASC`,
      )
      .all(project_id);
  }

  absorbMessages(project_id: string, turn: number): MessageRow[] {
    const queued = this.listQueuedMessages(project_id);
    if (queued.length === 0) return queued;
    const now = nowIso();
    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(`UPDATE messages SET queued_for_turn = ?, absorbed_at = ? WHERE id = ?`);
      for (const m of queued) stmt.run(turn, now, m.id);
    });
    tx();
    return queued;
  }

  // ---- Turns -------------------------------------------------------------

  createTurn(row: {
    turn_id: string;
    project_id: string;
    turn: number;
    agent: AgentName;
    agent_run_id: string;
  }): TurnRow {
    this.db
      .prepare(
        `INSERT INTO turns (turn_id, project_id, turn, agent, agent_run_id, started_at, ended_at, status)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 'running')`,
      )
      .run(row.turn_id, row.project_id, row.turn, row.agent, row.agent_run_id, nowIso());
    return this.getTurn(row.turn_id)!;
  }

  getTurn(turn_id: string): TurnRow | undefined {
    return this.db.prepare<[string], TurnRow>(`SELECT * FROM turns WHERE turn_id = ?`).get(turn_id);
  }

  endTurn(turn_id: string, status: "done" | "error"): void {
    this.db
      .prepare(`UPDATE turns SET status = ?, ended_at = ? WHERE turn_id = ?`)
      .run(status, nowIso(), turn_id);
  }

  nextTurnNumber(project_id: string): number {
    const row = this.db
      .prepare<[string], { max_turn: number | null }>(
        `SELECT MAX(turn) AS max_turn FROM turns WHERE project_id = ?`,
      )
      .get(project_id);
    return (row?.max_turn ?? -1) + 1;
  }

  // ---- Plugins -----------------------------------------------------------

  upsertPluginConfig(row: {
    id: string;
    connected: boolean;
    encrypted_json: string | null;
    masked_json: string;
    connected_at: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO plugin_configs (id, connected, encrypted_json, masked_json, connected_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           connected = excluded.connected,
           encrypted_json = excluded.encrypted_json,
           masked_json = excluded.masked_json,
           connected_at = excluded.connected_at`,
      )
      .run(row.id, row.connected ? 1 : 0, row.encrypted_json, row.masked_json, row.connected_at);
  }

  deletePluginConfig(id: string): void {
    this.db.prepare(`DELETE FROM plugin_configs WHERE id = ?`).run(id);
  }

  getPluginConfig(id: string): {
    id: string; connected: boolean; encrypted_json: string | null; masked_json: string; connected_at: string | null;
  } | undefined {
    const row = this.db
      .prepare<[string], { id: string; connected: number; encrypted_json: string | null; masked_json: string; connected_at: string | null }>(
        `SELECT * FROM plugin_configs WHERE id = ?`,
      )
      .get(id);
    return row ? { ...row, connected: row.connected === 1 } : undefined;
  }

  listPluginConfigs(): Array<{ id: string; connected: boolean; masked_json: string; connected_at: string | null }> {
    return this.db
      .prepare<[], { id: string; connected: number; masked_json: string; connected_at: string | null }>(
        `SELECT id, connected, masked_json, connected_at FROM plugin_configs`,
      )
      .all()
      .map((r) => ({ id: r.id, connected: r.connected === 1, masked_json: r.masked_json, connected_at: r.connected_at }));
  }
}
