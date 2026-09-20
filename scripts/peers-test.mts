/** Rules the peer matcher must hold. Run with: npx tsx scripts/peers-test.mts */
import { getDb, resetDemoData } from "../src/lib/db";
import { findPeerMatches, savePeerOptIn } from "../src/lib/peer-repo";
import { upsertEnrollment, saveTrial } from "../src/lib/repo";
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

resetDemoData();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
