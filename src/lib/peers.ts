import type { ParticipantProfile } from "./types";

/**
 * Peer matching: finding someone in a similar situation to talk to about a study.
 *
 * This file is the rule set. It decides who may be compared at all, and it is
 * the fallback matcher when no language model is connected. When one is, the
 * model ranks and explains matches (see peer-ai.ts), but only ever from the
 * fields both people offered, and every reason it gives is checked against them.
 *
 * What keeps this safe:
 *  - Opt-in, and only offered fields are compared. A field takes part in matching
 *    only when BOTH people chose to offer it. So nobody is matched on, and no
 *    reason ever reveals, something a person did not put forward.
 *  - Unknown never matches. Two people who both do not know their HER2 status do
 *    not thereby have it in common.
 *  - Not while enrolled. People are not paired about a study either of them is
 *    taking part in, because comparing experiences inside a trial can reveal
 *    which group someone is in and colour what they report.
 *  - No directory. You see a few suggested people for a purpose, never a list to
 *    browse, and only an alias until both sides connect.
 */

export const PEER_FIELDS = [
  { id: "condition", label: "My diagnosis" },
  { id: "stage", label: "Cancer stage, and whether it has spread" },
  { id: "biomarkers", label: "Biomarkers (hormone receptor, HER2)" },
  { id: "treatment", label: "Treatment so far" },
  { id: "age", label: "My age range" },
  { id: "practical", label: "Practical situation (travel, support)" },
] as const;
export type PeerField = (typeof PEER_FIELDS)[number]["id"];

export interface PeerOptIn { participantId: string; alias: string; offers: PeerField[]; about: string | null }

export interface PeerMatch {
  participantId: string;
  alias: string;
  about: string | null;
  strength: "strong" | "some";
  /** Plain-language overlaps, built only from fields both people offered. */
  reasons: string[];
  sameStudy: boolean;
}

const fact = (profile: ParticipantProfile, key: string) => {
  const found = profile.clinicalFacts.find((f) => f.key === key);
  return found && found.provenance === "self_reported" && found.value ? found.value.toLowerCase() : null;
};

const conditionFamily = (condition: string | null) =>
  !condition ? null : /breast/i.test(condition) ? "breast cancer" : /lung/i.test(condition) ? "lung cancer" : condition.toLowerCase();

const stageNumber = (profile: ParticipantProfile) => {
  const stage = fact(profile, "stage");
  if (!stage) return null;
  const roman = stage.match(/\b(iv|iii|ii|i)\b/)?.[1];
  return roman ? { i: 1, ii: 2, iii: 3, iv: 4 }[roman as "i"] : Number(stage.match(/\d/)?.[0]) || null;
};

/**
 * True when both people offered their diagnosis and the two differ. This stays a
 * rule in code whatever else does the matching: a different diagnosis is not a
 * weaker match, it is not a match.
 */
export function differentDiagnosis(me: ParticipantProfile, mine: PeerOptIn, them: ParticipantProfile, theirs: PeerOptIn): boolean {
  if (!mine.offers.includes("condition") || !theirs.offers.includes("condition")) return false;
  const a = conditionFamily(me.condition), b = conditionFamily(them.condition);
  return Boolean(a && b && a !== b);
}

export function scorePair(
  me: ParticipantProfile, mine: PeerOptIn, them: ParticipantProfile, theirs: PeerOptIn, sameStudy: boolean
): PeerMatch | null {
  const both = (field: PeerField) => mine.offers.includes(field) && theirs.offers.includes(field);
  const reasons: string[] = [];
  let score = 0;

  if (both("condition")) {
    const a = conditionFamily(me.condition), b = conditionFamily(them.condition);
    // A different diagnosis is not a weaker match. It is not a match.
    if (a && b && a !== b) return null;
    if (a && a === b) { score += 3; reasons.push(`You both have ${a}`); }
  }
  if (both("stage")) {
    const a = stageNumber(me), b = stageNumber(them);
    if (a && b && a === b) { score += 2; reasons.push("You are at the same stage"); }
    else if (a && b && Math.abs(a - b) === 1) { score += 1; reasons.push("You are at a similar stage"); }
    const ma = fact(me, "metastatic"), mb = fact(them, "metastatic");
    if (ma && mb && ma === mb) { score += 1; reasons.push(ma === "yes" ? "You are both living with metastatic disease" : "Neither of you has metastatic disease"); }
  }
  if (both("biomarkers")) {
    for (const [key, name] of [["hormone_receptor", "hormone receptor"], ["her2", "HER2"]] as const) {
      const a = fact(me, key), b = fact(them, key);
      if (a && b && a === b) { score += 1.5; reasons.push(`You are both ${name} ${a}`); }
    }
  }
  if (both("treatment")) {
    const a = fact(me, "prior_therapy"), b = fact(them, "prior_therapy");
    const shared = a && b ? ["surgery", "radiation", "chemotherapy", "endocrine", "immunotherapy"].filter((t) => a.includes(t) && b.includes(t)) : [];
    if (shared.length) { score += Math.min(2, shared.length); reasons.push(`You have both had ${shared.join(" and ")}${shared.includes("endocrine") ? " therapy" : ""}`); }
  }
  if (both("age") && me.ageYears != null && them.ageYears != null && Math.abs(me.ageYears - them.ageYears) <= 10) {
    score += 1; reasons.push("You are around the same age");
  }
  if (both("practical")) {
    if (me.needsTravelHelp && them.needsTravelHelp) { score += 0.5; reasons.push("You would both need help getting to visits"); }
    if (me.workConstraints && them.workConstraints) { score += 0.5; reasons.push("You are both fitting this around work"); }
  }
  if (sameStudy) { score += 2; reasons.unshift("You are both looking at this study"); }

  if (score < 3 || reasons.length === 0) return null;
  return { participantId: them.id, alias: theirs.alias, about: theirs.about, strength: score >= 6 ? "strong" : "some", reasons: reasons.slice(0, 4), sameStudy };
}

/** Words that suggest a conversation is drifting toward what it should avoid. */
export function needsGentleReminder(text: string): boolean {
  return /\b(placebo|control (group|arm)|which (arm|group)|randomi[sz]ed to|my dose|you should (take|stop|try)|side effects? (i|you) (got|had))\b/i.test(text);
}
