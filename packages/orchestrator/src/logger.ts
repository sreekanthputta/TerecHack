import pino, { type Logger } from "pino";
import { env } from "./env.js";

const isDev = env.node_env !== "production";

export const rootLogger: Logger = pino({
  level: env.log_level,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss.l", singleLine: false },
        },
      }
    : {}),
  base: { service: "orchestrator" },
});

export function projectLogger(project_id: string): Logger {
  return rootLogger.child({ project_id });
}

export function agentLogger(project_id: string, agent: string, turn: number): Logger {
  return rootLogger.child({ project_id, agent, turn });
}
