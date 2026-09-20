import { askModelForJson, modelLabel } from "./ai";

/**
 * What two connected people might talk about.
 *
 * This is where the language model helps: once two people have chosen to
 * connect, it proposes an opening line and a few topics they can review and use
 * or ignore. It receives only the overlaps both of them offered and the study's
 * public title. It never sees names, contact details, or anything one person kept
 * back, and it cannot send a message: suggestions are inserted into the composer
 * and the person presses send.
 *
 * With no model available the same shape comes from a template, and the screen
 * says which one produced it.
 */

export interface PeerAgenda { opener: string; topics: string[]; source: string }

const SYSTEM = `You help two people who are each considering the same clinical study start a supportive conversation.
Rules:
- Suggest only practical and emotional topics: logistics, how they are deciding, questions they asked the study team, fitting visits around life.
- Never suggest comparing symptoms or side effects, guessing treatment groups, or recommending any treatment. Medical questions belong to the study team.
- Warm, plain, brief. No medical claims. Use only the facts given.
Reply with one JSON object: {"opener": "one friendly first message, under 35 words", "topics": ["3 or 4 short topic prompts, each under 14 words"]}`;

export async function suggestAgenda(input: { reasons: string[]; studyTitle: string | null }): Promise<PeerAgenda> {
  const parsed = await askModelForJson(
    SYSTEM,
    `What they have in common (each chose to share this): ${input.reasons.join("; ") || "they are both considering a clinical study"}\nStudy: ${input.studyTitle ?? "not a specific study"}`,
    "PeerAgenda"
  );
  const topics = Array.isArray(parsed?.topics) ? parsed.topics.map(String).filter(Boolean).slice(0, 4) : [];
  if (parsed && typeof parsed.opener === "string" && topics.length >= 2) {
    return { opener: parsed.opener.slice(0, 280), topics, source: `Suggested by ${modelLabel() ?? "a language model"}. Review before you use it.` };
  }

  const study = input.studyTitle ? "this study" : "taking part in a study";
  return {
    opener: `Hi, I'm also looking at ${study} and trying to work out if it fits my life. Would you be up for comparing notes?`,
    topics: [
      `What made you start looking at ${study}?`,
      "How are you thinking about the travel and time it would take?",
      "What have you asked the study team so far, and what did they say?",
      "Who is helping you decide?",
    ],
    source: "Built from a template. No language model was involved.",
  };
}
