import { customAlphabet } from "nanoid";
import { ulid } from "ulid";

const lowerAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano8 = customAlphabet(lowerAlphabet, 8);

export const newProjectId = (): string => ulid();
export const newDecisionId = (): string => nano8();
export const newBugId = (): string => nano8();
export const newTurnId = (): string => crypto.randomUUID();
export const newAgentRunId = (): string => crypto.randomUUID();
