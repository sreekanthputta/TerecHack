import type { FastifyInstance } from "fastify";

export async function registerReplayRoutes(app: FastifyInstance) {
  app.post("/replay/project", async () => ({
    id: "lqa_stub",
    url: "https://qa.replay.io/projects/stub",
    exploration_id: "expl_stub",
  }));
  app.get("/replay/project/:id/status", async () => ({
    state: "done",
    journeys_passed_count: 0,
    journeys_total: 0,
    updated_at: new Date().toISOString(),
  }));
  app.get("/replay/project/:id/bugs", async () => ({ bugs: [] }));
  app.get("/replay/bugs/:bug_id", async () => ({
    id: "b_stub",
    severity: "minor",
    title: "stub",
    observed: "-",
    expected: "-",
    repro: [],
    evidence_url: "-",
    route: "-",
  }));
  app.post("/replay/project/:id/explorations", async () => ({
    exploration_id: "expl_stub_2",
  }));
}
