import { askModelForJson, modelLabel, tidy } from "./ai";
import { PEER_FIELDS, type PeerField, type PeerMatch, type PeerOptIn } from "./peers";
import type { ParticipantProfile } from "./types";

/**
 * Peer matching by a language model, inside a privacy boundary the model cannot cross.
 *
 * The order is the whole design:
 *
 *  1. CODE decides who may be compared at all: both opted in, neither is taking
 *     part in the study, and a different diagnosis is never a match.
 *  2. CODE builds a "mutual view" of each pair: only the fields BOTH people
 *     offered, and only facts both actually know. Names, aliases, ids, contact
 *     details and every field either person held back are never sent.
 *  3. The MODEL ranks those pairs and says, in plain words, what they share. It
 *     can read free text a rule cannot: that a lumpectomy is surgery, that
 *     tamoxifen is endocrine therapy, that two people both juggle shift work.
 *  4. CODE checks the answer. A reason is kept only if it names a field that is
 *     in that pair's mutual view. Anything else is dropped, not shown.
 *
 * So the guarantee does not depend on the model behaving. A match reason cannot
 * reveal something a person held back, because the model was never given it.
 */

export interface MutualFact { field: PeerField; label: string; mine: string; theirs: string }

const fact = (profile: ParticipantProfile, key: string) => {
  const found = profile.clinicalFacts.find((f) => f.key === key);
  return found && found.provenance === "self_reported" && found.value ? found.value : null;
};
// A decade, not a birthday: enough to say "around the same age", no more.
const ageBand = (age: number | null) => (age == null ? null : age < 20 ? "under 20" : `${Math.floor(age / 10) * 10}s`);
const practical = (p: ParticipantProfile) => [
  p.workConstraints ? `work: ${p.workConstraints}` : null,
  p.needsTravelHelp ? "needs help getting to visits" : null,
  p.caregiverAvailable === true ? "has someone who can come along" : p.caregiverAvailable === false ? "no one available to come along" : null,
  p.maxTravelMinutes != null ? `can travel up to ${p.maxTravelMinutes} minutes` : null,
].filter(Boolean).join("; ") || null;

/**
 * What two people may be compared on. A field appears only when both offered it
 * and both have a known value for it: two people who both do not know their HER2
 * status do not have it in common.
 */
export function mutualView(me: ParticipantProfile, mine: PeerOptIn, them: ParticipantProfile, theirs: PeerOptIn): MutualFact[] {
  const out: MutualFact[] = [];
  const add = (field: PeerField, label: string, a: string | null, b: string | null) => {
    if (mine.offers.includes(field) && theirs.offers.includes(field) && a && b) out.push({ field, label, mine: a, theirs: b });
  };
  add("condition", "diagnosis", me.condition, them.condition);
  add("stage", "stage", fact(me, "stage"), fact(them, "stage"));
  add("stage", "whether it has spread (metastatic)", fact(me, "metastatic"), fact(them, "metastatic"));
  add("biomarkers", "hormone receptor status", fact(me, "hormone_receptor"), fact(them, "hormone_receptor"));
  add("biomarkers", "HER2 status", fact(me, "her2"), fact(them, "her2"));
  add("treatment", "treatment so far", fact(me, "prior_therapy"), fact(them, "prior_therapy"));
  add("age", "age range", ageBand(me.ageYears), ageBand(them.ageYears));
  add("practical", "practical situation", practical(me), practical(them));
  return out;
}

const SYSTEM = `You match patients who might want to talk to each other about taking part in a clinical study. You are given ONE person ("me") compared with several candidates. For each candidate you see ONLY the facts that both people agreed to share with each other. Nothing else exists for you.

How to work, for EACH candidate:
1. Go through every fact line. Compare "me" with "them" by meaning, not spelling.
2. Whenever the two values mean the same thing, or overlap, write one reason for it. Lists overlap when they share items: "Surgery, radiation, endocrine therapy" and "Surgery, chemotherapy, radiation" overlap on surgery and radiation, so write "You have both had surgery and radiation". Do not skip a genuine overlap.
3. Understand meaning: a lumpectomy or mastectomy is surgery; tamoxifen or an aromatase inhibitor is endocrine (hormone) therapy; "metastatic breast cancer" and "breast cancer" are the same diagnosis at different stages; shift work, fixed weekday hours and being a student are all schedules to fit visits around.
4. If the values differ, write nothing for that line. A difference is never a reason.
5. Score from what you found. Same diagnosis is the base (about 45). Add for each further thing in common: same or adjacent stage and same metastatic status count most (about 15 each), then treatment overlap and matching biomarkers (about 10 each), then age range and practical situation (about 5 each). Take away about 20 when one person has metastatic disease and the other does not, because their situations are very different.

Rules:
- Use only the facts given for that candidate. Never guess, never infer a fact that is not written, never mention eligibility or whether someone should join a study.
- Every reason names the ONE field it is based on, using exactly one of these ids: ${PEER_FIELDS.map((f) => f.id).join(", ")}.
- Write each reason to "me", starting with "You both have", "You are both", "You have both" or "Neither of you", under 16 words, plain and kind. Say "You both have breast cancer", never "You both share a diagnosis".

Reply with one JSON object:
{"candidates":[{"id":"c1","score":0-100,"reasons":[{"field":"treatment","text":"You have both had surgery and hormone therapy"}]}]}
Score guide: 75 and above is a lot in common, 45 to 74 is some things in common, below 45 is not worth suggesting. Include every candidate id you were given, even those with a low score.`;

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AiCandidate { participantId: string; alias: string; about: string | null; sameStudy: boolean; facts: MutualFact[] }

export interface AiMatchResult { matches: PeerMatch[]; source: "model"; model: string }

/**
 * Asks the model to rank candidates. Returns null when no model is configured,
 * the call fails, or nothing usable comes back, so the caller can fall back to
 * the rule-based matcher and say so.
 */
export async function rankWithModel(candidates: AiCandidate[]): Promise<AiMatchResult | null> {
  const model = modelLabel();
  const usable = candidates.filter((c) => c.facts.length > 0);
  if (!model || usable.length === 0) return null;

  // The model sees "c1", "c2": never an id, an alias, or the text a person wrote about themselves.
  const tagged = usable.map((candidate, index) => ({ tag: `c${index + 1}`, candidate }));
  const user = tagged.map(({ tag, candidate }) =>
    `Candidate ${tag}\n` + candidate.facts.map((f) => `- [${f.field}] ${f.label}: me = "${f.mine}" | them = "${f.theirs}"`).join("\n")
  ).join("\n\n");

  const parsed = await askModelForJson(SYSTEM, user, "PeerMatch");
  const matches = verifyRanking(tagged, parsed);
  if (!matches) return null;
  return { matches, source: "model", model };
}

/**
 * Keeps only what can be stood behind. Separate from the call so it can be
 * tested against a model that misbehaves: unknown candidates, low scores,
 * reasons for fields the pair never both offered, and anything about
 * eligibility are all dropped here.
 */
export function verifyRanking(tagged: { tag: string; candidate: AiCandidate }[], parsed: any): PeerMatch[] | null {
  const rows: unknown[] = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  if (rows.length === 0) return null;

  const matches: PeerMatch[] = [];
  for (const row of rows as { id?: unknown; score?: unknown; reasons?: unknown }[]) {
    const entry = tagged.find((t) => t.tag === row.id);
    const score = typeof row.score === "number" ? row.score : Number(row.score);
    if (!entry || !Number.isFinite(score) || score < 45) continue;

    const allowed = new Set(entry.candidate.facts.map((f) => f.field));
    const reasons = (Array.isArray(row.reasons) ? row.reasons : [])
      .filter((r): r is { field: string; text: string } => Boolean(r) && typeof r.field === "string" && typeof r.text === "string")
      // The check that makes the guarantee structural: no mutual fact for that field, no reason.
      .filter((r) => allowed.has(r.field as PeerField))
      .map((r) => tidy(r.text))
      .filter((text) => text.split(/\s+/).length >= 3 && text.length <= 140 && !/\b(eligib|qualif|should (join|enrol|enroll))/i.test(text));
    const unique = [...new Set(reasons)].slice(0, 4);
    if (unique.length === 0) continue;

    if (entry.candidate.sameStudy) unique.unshift("You are both looking at this study");
    matches.push({
      participantId: entry.candidate.participantId, alias: entry.candidate.alias, about: entry.candidate.about,
      strength: score >= 75 ? "strong" : "some", reasons: unique.slice(0, 4), sameStudy: entry.candidate.sameStudy,
    });
  }
  return matches;
}
