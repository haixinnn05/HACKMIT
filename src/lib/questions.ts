import type { Question } from "./types";

/**
 * Whether a question currently stands answered.
 *
 * This is decided by state, not by whether answer text exists. A reopened
 * question keeps its earlier answer as history while being open again, and a
 * coordinator's unsent draft lives in its own table so it can never be mistaken
 * for something the participant was told.
 */
export function isAnswered(question: Pick<Question, "state">): boolean {
  return question.state === "reviewed_answer" || question.state === "resolved";
}

export const QUESTION_STATE_LABEL: Record<Question["state"], string> = {
  open: "Open",
  assigned: "Assigned",
  draft_answer: "Draft answer",
  reviewed_answer: "Answered",
  resolved: "Resolved",
};

/** Simulated site staff a question can be assigned to. */
export const SITE_STAFF = [
  { id: "coordinator", label: "R. Alvarez, Research Coordinator" },
  { id: "investigator", label: "Dr. N. Okoye, Investigator" },
  { id: "finance", label: "Site finance office" },
] as const;
