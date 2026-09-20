/** Rules the peer matcher must hold. Run with: npx tsx scripts/peers-test.mts */
import { getDb, resetDemoData } from "../src/lib/db";
import { findPeerMatches, savePeerOptIn } from "../src/lib/peer-repo";
import { upsertEnrollment, saveTrial, getParticipant } from "../src/lib/repo";
import { mutualView, verifyRanking } from "../src/lib/peer-ai";
getDb(); resetDemoData();
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = "") => { if (ok) pass += 1; else fail += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : ` (${detail})`}`); };
const ALL = ["condition", "stage", "biomarkers", "treatment", "age", "practical"] as const;

check("someone who has not opted in gets no matches and cannot be found", findPeerMatches("p-maria", null).status === "not_opted_in");
savePeerOptIn({ participantId: "p-dee", alias: "Dee", offers: [...ALL], about: null });
const before = findPeerMatches("p-dee", null);
check("an opted-out person never appears in anyone's suggestions", before.status === "ok" && !before.matches.some((m) => m.participantId === "p-maria"));

savePeerOptIn({ participantId: "p-maria", alias: "Mari", offers: [...ALL], about: null });
const full = findPeerMatches("p-maria", null);
const ids = full.status === "ok" ? full.matches.map((m) => m.participantId) : [];
check("a different diagnosis is never suggested", !ids.includes("p-eval-03"), ids.join(","));
check("suggestions are a handful, not a directory", ids.length > 0 && ids.length <= 3, String(ids.length));
const reasons = full.status === "ok" ? full.matches.flatMap((m) => m.reasons).join(" | ") : "";
check("an unknown fact is never a reason (Maria does not know her HER2)", !/HER2/.test(reasons), reasons);

savePeerOptIn({ participantId: "p-maria", alias: "Mari", offers: ["condition"], about: null });
const narrow = findPeerMatches("p-maria", null);
const narrowReasons = narrow.status === "ok" ? narrow.matches.flatMap((m) => m.reasons).join(" | ") : "";
check("only fields BOTH people offered are compared or revealed", !/stage|receptor|age|travel|therapy/i.test(narrowReasons), narrowReasons);

savePeerOptIn({ participantId: "p-maria", alias: "Mari", offers: [...ALL], about: null });
saveTrial("p-dee", "TP-FIX-001");
const about = findPeerMatches("p-maria", "TP-FIX-001");
check("someone looking at the same study is ranked first", about.status === "ok" && about.matches[0]?.participantId === "p-dee" && about.matches[0].sameStudy);
upsertEnrollment({ participantId: "p-dee", trialId: "TP-FIX-001", status: "participating", visits: [] });
const afterJoin = findPeerMatches("p-maria", "TP-FIX-001");
check("a person who has joined the study is no longer suggested for it", afterJoin.status === "ok" && !afterJoin.matches.some((m) => m.participantId === "p-dee"));
upsertEnrollment({ participantId: "p-maria", trialId: "TP-FIX-001", status: "participating", visits: [] });
check("and someone who has joined cannot be matched about it themselves", findPeerMatches("p-maria", "TP-FIX-001").status === "enrolled");


// ---- What the language model is allowed to see. These hold with or without a model.
{
  const maria = getParticipant("p-maria")!, dee = getParticipant("p-dee")!;
  const everything = { participantId: "p-dee", alias: "Dee", offers: [...ALL], about: null };
  const narrow = mutualView(maria, { participantId: "p-maria", alias: "M", offers: ["condition", "age"], about: null }, dee, everything);
  check("the model sees only fields BOTH people offered", narrow.every((f) => f.field === "condition" || f.field === "age") && narrow.length === 2, JSON.stringify(narrow.map((f) => f.field)));
  const full = mutualView(maria, { participantId: "p-maria", alias: "M", offers: [...ALL], about: null }, dee, everything);
  check("a fact one person does not know is never sent (Maria's HER2 is unknown)", !full.some((f) => f.label === "HER2 status"));
  const sent = JSON.stringify(full).toLowerCase();
  const held = [maria.displayName, dee.displayName, maria.id, dee.id, maria.contact?.email, dee.contact?.email, maria.contact?.phone, maria.postalCode, String(maria.ageYears), String(dee.ageYears)]
    .filter((v): v is string => Boolean(v)).map((v) => v.toLowerCase().replace(/\s*\(synthetic\)/, ""));
  check("names, ids, contact details, postcode and exact age are never sent", held.every((v) => !sent.includes(v)), held.filter((v) => sent.includes(v)).join(", "));
  check("age goes as a decade, not a number", full.some((f) => f.field === "age" && f.mine === "50s" && f.theirs === "30s"));
  // A model that misbehaves in every way we guard against.
  const pair = [{ tag: "c1", candidate: { participantId: "p-dee", alias: "Dee", about: null, sameStudy: false, facts: narrow } }];
  const hostile = { candidates: [
    { id: "c1", score: 90, reasons: [
      { field: "condition", text: "You both have breast cancer" },
      { field: "treatment", text: "You have both had chemotherapy" },        // field was not mutually offered
      { field: "biomarkers", text: "You are both HER2 positive" },            // nor was this
      { field: "condition", text: "You both look eligible for this study" },  // never said
    ] },
    { id: "c9", score: 99, reasons: [{ field: "condition", text: "You both have breast cancer" }] }, // not a candidate
  ] };
  const kept = verifyRanking(pair, hostile) ?? [];
  check("a reason for a field the pair did not both offer is dropped", kept.length === 1 && kept[0].reasons.join("|") === "You both have breast cancer", JSON.stringify(kept.map((m) => m.reasons)));
  check("a candidate the model invents is ignored", !kept.some((m) => m.participantId !== "p-dee"));
  check("a match with no surviving reason is not shown", (verifyRanking(pair, { candidates: [{ id: "c1", score: 95, reasons: [{ field: "treatment", text: "You have both had chemotherapy" }] }] }) ?? []).length === 0);
  check("a low score is not suggested", (verifyRanking(pair, { candidates: [{ id: "c1", score: 30, reasons: [{ field: "condition", text: "You both have breast cancer" }] }] }) ?? []).length === 0);
  check("nothing offered by only one side means nothing to compare", mutualView(maria, { participantId: "p-maria", alias: "M", offers: ["treatment"], about: null }, dee, { ...everything, offers: ["stage"] }).length === 0);
}
resetDemoData();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
