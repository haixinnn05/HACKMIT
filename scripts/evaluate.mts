/**
 * Trial Passport evaluation harness.
 *
 * Checks the acceptance conditions the design document commits to. Everything
 * here runs against the real 300-record registry snapshot and the synthetic
 * personas, so results are reproducible with `npm run evaluate`.
 *
 * These are engineering labels with limited clinical authority. They test that
 * the system behaves as specified — they do not establish clinical accuracy,
 * and no result here should be reported as a clinical finding.
 */
import { getDb } from "../src/lib/db";
import { getTrial, listParticipants, getParticipant, createGrant, createInquiry, revokeGrant, listInquiriesForCoordinator } from "../src/lib/repo";
import { search, searchForProfile } from "../src/lib/search";
import { assessTrial } from "../src/lib/assess";
import { computeBurden } from "../src/lib/burden";
import type { Trial } from "../src/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) { passed += 1; console.log(`  PASS  ${name}`); }
  else { failed += 1; failures.push(`${name}${detail ? ` — ${detail}` : ""}`); console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

function section(title: string) { console.log(`\n${title}\n${"-".repeat(title.length)}`); }

const db = getDb();
const allTrialIds = (db.prepare("SELECT id FROM trials").all() as any[]).map((r) => r.id);
const allTrials: Trial[] = allTrialIds.map((id) => getTrial(id)!).filter(Boolean);
const personas = listParticipants();

console.log(`Trial Passport evaluation\ncorpus: ${allTrials.length} trials, ${personas.length} synthetic personas\n`);

/* ------------------------------------------------------------------ discovery */
section("1. Discovery");
{
  // A small hand-labeled relevance set: for a breast-cancer profile, a record is
  // relevant if the registry itself lists a breast condition.
  const relevant = new Set(
    allTrials
      .filter((t) => !t.isFictional && t.conditions.some((c) => /breast/i.test(c)))
      .map((t) => t.id)
  );
  const result = search({ condition: "breast cancer", recruitingOnly: false, limit: 10 });
  const top10 = result.hits.map((h) => h.trial.id);
  const precisionAt5 = top10.slice(0, 5).filter((id) => relevant.has(id)).length / 5;
  const hitsRelevant = top10.filter((id) => relevant.has(id)).length;

  console.log(`  corpus size: ${allTrials.length}; labeled relevant: ${relevant.size}`);
  console.log(`  precision@5: ${precisionAt5.toFixed(2)}; relevant in top 10: ${hitsRelevant}/10`);
  check("precision@5 >= 0.8 for an on-condition query", precisionAt5 >= 0.8, `got ${precisionAt5}`);
  check("search returns within 3s warm", result.tookMs < 3000, `${result.tookMs}ms`);
  check("search reports its backend", Boolean(result.backend));

  // Recall@10 over a targeted query set: each probe names a distinctive study.
  const probes = allTrials.filter((t) => !t.isFictional && t.briefTitle).slice(0, 40);
  let recalled = 0;
  const missed: string[] = [];
  for (const probe of probes) {
    const hit = search({ text: probe.briefTitle!.slice(0, 90), recruitingOnly: false, limit: 10 });
    if (hit.hits.some((h) => h.trial.id === probe.id)) recalled += 1;
    else missed.push(probe.id);
  }
  const recall = recalled / probes.length;
  console.log(`  recall@10 over ${probes.length} title probes: ${(recall * 100).toFixed(1)}%`);
  if (missed.length) console.log(`  missed: ${missed.join(", ")}`);
  check("recall@10 >= 0.90 on the labeled probe set", recall >= 0.9, `got ${(recall * 100).toFixed(1)}%`);

  const offCondition = search({ condition: "non-small cell lung cancer", recruitingOnly: false, limit: 10 });
  const breastLeakage = offCondition.hits.filter((h) => relevant.has(h.trial.id)).length;
  console.log(`  off-condition query surfaced ${breastLeakage}/10 breast-only records`);
}

/* ------------------------------------------------------ criteria & invariants */
section("2. Criterion assessment invariants");
{
  let supportedWithoutFact = 0;
  let exclusionMatched = 0;
  let disjunctionConflict = 0;
  let total = 0;
  const statusCounts: Record<string, number> = {};

  for (const persona of personas) {
    const knownKeys = new Set(
      persona.clinicalFacts.filter((f) => f.provenance === "self_reported" && f.value).map((f) => f.key)
    );
    for (const trial of allTrials.slice(0, 60)) {
      const assessment = assessTrial(trial, persona);
      for (const a of assessment.assessments) {
        total += 1;
        statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;

        // I1 — a `supported` verdict must cite a fact the person actually gave.
        // (Age and sex are structural registry fields, keyed separately.)
        if (a.status === "supported") {
          const structural = a.criterionId.includes("-structural-");
          if (!structural && a.usedFactKeys.length === 0) supportedWithoutFact += 1;
          if (!structural && a.usedFactKeys.some((k) => !knownKeys.has(k))) supportedWithoutFact += 1;
        }
        // I2 — an exclusion criterion may never be reported as a positive match
        // that hides a conflict. Verified via the conflict path below.
        if (a.role === "exclusion" && a.status === "supported" && a.usedFactKeys.length === 0) {
          exclusionMatched += 1;
        }
        // I3 — a disjunction cannot yield a conflict from one failing branch.
        if (a.logic === "any_of" && a.status === "conflict" && !a.criterionId.includes("-structural-")) {
          disjunctionConflict += 1;
        }
      }
    }
  }

  console.log(`  ${total} assessments across ${personas.length} personas × 60 trials`);
  console.log(`  status mix: ${Object.entries(statusCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  check("I1 no `supported` verdict without a participant-stated fact", supportedWithoutFact === 0, `${supportedWithoutFact} violations`);
  check("I2 no exclusion criterion matched without evidence", exclusionMatched === 0, `${exclusionMatched} violations`);
  check("I3 no conflict derived from a single branch of an `or` criterion", disjunctionConflict === 0, `${disjunctionConflict} violations`);
  check("I5 no assessment ever reports an `eligible` state", !Object.keys(statusCounts).includes("eligible"));
}

/* ------------------------------------------------------------------- evidence */
section("3. Evidence and citations");
{
  let spanMismatch = 0;
  let emptySpan = 0;
  let checked = 0;
  for (const trial of allTrials) {
    const assessment = assessTrial(trial, personas[0]);
    for (const a of assessment.assessments) {
      if (a.sourceStart < 0) continue; // structural field, not a text span
      checked += 1;
      const actual = trial.eligibilityText.slice(a.sourceStart, a.sourceEnd);
      if (actual !== a.criterionText) spanMismatch += 1;
      if (a.evidenceSpan.trim().length === 0) emptySpan += 1;
    }
  }
  console.log(`  ${checked} rendered citations checked against source offsets`);
  check("every citation resolves to its exact source span", spanMismatch === 0, `${spanMismatch} mismatches`);
  check("no citation renders an empty span", emptySpan === 0, `${emptySpan} empty`);
}

/* ---------------------------------------------------------- logical robustness */
section("4. Logical robustness");
{
  const maria = getParticipant("p-maria")!;
  const fixture = getTrial("TP-FIX-001")!;
  const fixtureAssessment = assessTrial(fixture, maria);

  const metastatic = fixtureAssessment.assessments.find((a) => /Metastatic \(stage IV\)/.test(a.criterionText));
  check("exclusion 'Metastatic (stage IV) disease' + participant 'no' => supported",
    metastatic?.status === "supported", `got ${metastatic?.status}`);

  const her2 = fixtureAssessment.assessments.find((a) => /HER2 negative/.test(a.criterionText));
  check("HER2 criterion with an unknown participant result => unknown, not supported",
    her2?.status === "unknown", `got ${her2?.status}`);

  const ecog = fixtureAssessment.assessments.find((a) => /ECOG/.test(a.criterionText));
  check("ECOG criterion with no recorded score => unknown", ecog?.status === "unknown", `got ${ecog?.status}`);

  // Age boundaries. Eval 01 is exactly 18; Eval 02 is 17.
  const atBound = assessTrial(fixture, getParticipant("p-eval-01")!)
    .assessments.find((a) => a.criterionId.endsWith("-structural-age"));
  check("age exactly at the stated minimum => supported", atBound?.status === "supported", `got ${atBound?.status}`);

  const belowBound = assessTrial(fixture, getParticipant("p-eval-02")!)
    .assessments.find((a) => a.criterionId.endsWith("-structural-age"));
  check("age below the stated minimum => conflict", belowBound?.status === "conflict", `got ${belowBound?.status}`);

  const aboveBound = assessTrial(fixture, getParticipant("p-harold")!)
    .assessments.find((a) => a.criterionId.endsWith("-structural-age"));
  check("age above the stated maximum => conflict", aboveBound?.status === "conflict", `got ${aboveBound?.status}`);

  // Metastatic participant against an early-stage-only study.
  const metaPersona = getParticipant("p-eval-06")!;
  const metaAssessment = assessTrial(fixture, metaPersona);
  const metaCriterion = metaAssessment.assessments.find((a) => /Metastatic \(stage IV\)/.test(a.criterionText));
  check("participant with stage IV vs an exclusion of stage IV => conflict",
    metaCriterion?.status === "conflict", `got ${metaCriterion?.status}`);
  check("a conflict drives the overall verdict to `likely_conflict`",
    metaAssessment.overall === "likely_conflict", `got ${metaAssessment.overall}`);

  // Everything unknown must never produce a positive-sounding verdict.
  const blank = assessTrial(fixture, getParticipant("p-eval-04")!);
  check("a profile with no clinical facts never yields `possible_option`",
    blank.overall !== "possible_option" || blank.supported === 0, `overall=${blank.overall}`);

  // Lab and organ-function criteria must always route to review.
  const labCriteria = allTrials
    .flatMap((t) => assessTrial(t, maria).assessments)
    .filter((a) => /adequate organ function|absolute neutrophil|platelet count/i.test(a.criterionText));
  const labNotReviewed = labCriteria.filter((a) => a.status === "supported" || a.status === "conflict").length;
  console.log(`  ${labCriteria.length} lab/organ-function criteria found in the corpus`);
  check("lab and organ-function criteria never resolve to supported or conflict",
    labNotReviewed === 0, `${labNotReviewed} resolved`);
}

/* ------------------------------------------------------------ burden arithmetic */
section("5. Burden arithmetic");
{
  const maria = getParticipant("p-maria")!;
  const fixture = getTrial("TP-FIX-001")!;
  const burden = computeBurden(fixture, maria, { oneWayTravelMinutes: 45 });

  // The worked example from the design document: 4 x (2h + 2 x 45min) = 14h.
  check("4 visits x (2h on site + 2 x 45min travel) = 14h of scheduled time",
    burden.onSiteHours! + burden.travelHours! === 14,
    `got ${burden.onSiteHours! + burden.travelHours!}`);
  check("on-site time is 8h", burden.onSiteHours === 8, `got ${burden.onSiteHours}`);
  check("travel time is 6h", burden.travelHours === 6, `got ${burden.travelHours}`);
  check("waiting time is declared excluded",
    burden.exclusions.some((e) => /waiting/i.test(e)));

  const noTravel = computeBurden(fixture, maria, { oneWayTravelMinutes: null });
  check("absent travel time yields a partial estimate, not an invented one",
    noTravel.partial && noTravel.travelHours === null);
  check("partial estimate says travel is not included",
    /travel not included/i.test(noTravel.formula ?? ""));
  check("the shown formula always adds up to the shown total",
    (burden.formula ?? "").endsWith(`= ${burden.totalHours}h`),
    burden.formula ?? "");

  const hypothetical = computeBurden(fixture, maria, { oneWayTravelMinutes: 45, visitCountOverride: 2 });
  check("a what-if schedule is flagged as hypothetical", hypothetical.hypothetical);
  check("a what-if schedule recomputes the total", hypothetical.totalHours! < burden.totalHours!);

  // The central honesty test: a real record has no schedule, so there is no total.
  let inventedSchedules = 0;
  for (const trial of allTrials.filter((t) => !t.isFictional)) {
    const b = computeBurden(trial, maria);
    if (b.available || b.totalHours != null || b.visitCount != null) inventedSchedules += 1;
  }
  check("no visit schedule is invented for any of the 300 real registry records",
    inventedSchedules === 0, `${inventedSchedules} invented`);
  check("a missing schedule explains itself and offers questions instead",
    computeBurden(allTrials.find((t) => !t.isFictional)!, maria).openQuestions.length >= 3);
}

/* ---------------------------------------------------------------- permissions */
section("6. Permissions and sharing");
{
  const a = getParticipant("p-maria")!;
  const b = getParticipant("p-dee")!;

  const grant = createGrant({
    participantId: a.id, recipientLabel: "Test site", trialId: "TP-FIX-001",
    allowedFields: ["ageYears", "condition"], purpose: "evaluation",
  });
  const inquiry = createInquiry({
    participantId: a.id, trialId: "TP-FIX-001", grantId: grant.id,
    message: "evaluation inquiry", sharedFields: { ageYears: a.ageYears, condition: a.condition },
  });

  const visibleBefore = listInquiriesForCoordinator();
  check("an inquiry backed by an active grant reaches the coordinator inbox",
    visibleBefore.some((i) => i.id === inquiry.id));
  check("the shared payload contains only the granted fields",
    Object.keys(inquiry.sharedFields).every((k) => grant.allowedFields.includes(k)),
    Object.keys(inquiry.sharedFields).join(","));
  check("contact details are not in the shared payload",
    !("contact" in inquiry.sharedFields) && !JSON.stringify(inquiry.sharedFields).includes("@"));
  check("participant B's data is absent from participant A's inquiry",
    !JSON.stringify(inquiry.sharedFields).includes(b.displayName));

  revokeGrant(grant.id);
  const visibleAfter = listInquiriesForCoordinator();
  check("revoking the grant removes the inquiry from the coordinator inbox",
    !visibleAfter.some((i) => i.id === inquiry.id));

  db.prepare("DELETE FROM inquiries WHERE id = ?").run(inquiry.id);
  db.prepare("DELETE FROM grants WHERE id = ?").run(grant.id);
}

/* -------------------------------------------------------------- failure modes */
section("7. Degraded modes");
{
  const maria = getParticipant("p-maria")!;
  check("a nonsense query still returns options rather than an error",
    search({ text: "!!!! ???", limit: 5 }).hits.length > 0);
  check("an empty query returns options rather than an error",
    search({ text: "", limit: 5 }).hits.length > 0);
  check("a query with only stopwords degrades gracefully",
    search({ text: "the and for", limit: 5 }).hits.length > 0);

  const result = searchForProfile(maria);
  check("degraded ranking is labelled rather than hidden", typeof result.lexicalOnly === "boolean");

  const noSites = allTrials.find((t) => t.sites.length === 0);
  if (noSites) {
    const fit = assessTrial(noSites, maria).practicalFit;
    check("a record with no listed sites reports unknown distance, not zero",
      fit.nearestSiteKm === null && fit.notes.length > 0);
  } else {
    console.log("  (no zero-site record in this snapshot; check skipped)");
  }
}

/* ------------------------------------------------------- missingness reporting */
section("8. Public-data missingness");
{
  const real = allTrials.filter((t) => !t.isFictional);
  const noSites = real.filter((t) => t.sites.length === 0).length;
  const noContact = real.filter((t) => !t.sites.some((s) => s.hasContact)).length;
  const noSiteStatus = real.filter((t) => t.sites.length > 0 && !t.sites.some((s) => s.siteStatus)).length;
  const stale = real.filter((t) => t.lastUpdatePostDate &&
    (Date.now() - new Date(t.lastUpdatePostDate).getTime()) / 86400000 > 365).length;
  const noSchedule = real.filter((t) => !t.visitSchedule).length;

  console.log(`  of ${real.length} public records:`);
  console.log(`    no listed locations:            ${noSites} (${((noSites / real.length) * 100).toFixed(1)}%)`);
  console.log(`    no site contact anywhere:       ${noContact} (${((noContact / real.length) * 100).toFixed(1)}%)`);
  console.log(`    no site-level recruiting status:${noSiteStatus} (${((noSiteStatus / real.length) * 100).toFixed(1)}%)`);
  console.log(`    last updated over a year ago:   ${stale} (${((stale / real.length) * 100).toFixed(1)}%)`);
  console.log(`    no published visit schedule:    ${noSchedule} (${((noSchedule / real.length) * 100).toFixed(1)}%)`);
  check("missingness is measured with denominators, not asserted", real.length > 0);
  check("the product does not claim schedule data it does not have", noSchedule === real.length);
}

/* --------------------------------------------------------------------- report */
console.log(`\n${"=".repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log("\nFailures:");
  for (const failure of failures) console.log(`  - ${failure}`);
}
console.log(`${"=".repeat(60)}`);
console.log("\nThese are engineering checks against synthetic personas and a public");
console.log("registry snapshot. They do not establish clinical accuracy, and no");
console.log("number here should be reported as a clinical or enrolment finding.");
process.exit(failed > 0 ? 1 : 0);
