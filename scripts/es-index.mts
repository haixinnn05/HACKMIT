/**
 * Loads every study and every eligibility passage into Elasticsearch, with
 * source ids and version metadata next to the search text, then checks that
 * search through it is at least as good as the built-in backend.
 *
 *   npm run es:index            index, then verify
 *   npm run es:index -- --check verify only
 *
 * Reads ELASTICSEARCH_URL (and ELASTICSEARCH_API_KEY, or _USERNAME/_PASSWORD)
 * from the environment or .env.local. Never prints a credential.
 */
import { existsSync, readFileSync } from "node:fs";
for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}
const { getDb } = await import("../src/lib/db");
const { elasticConfigured, elasticReady, elasticRequest, indexAll, PASSAGES_INDEX, TRIALS_INDEX } = await import("../src/lib/elastic");
const { search, searchAsync } = await import("../src/lib/search");

if (!elasticConfigured()) {
  console.error("\n  ELASTICSEARCH_URL is not set, so there is nothing to index into.\n  The app is using SQLite FTS5, which needs no setup.\n");
  process.exit(1);
}
const host = new URL(process.env.ELASTICSEARCH_URL!).host;
const db = getDb();
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => { if (!ok) failed += 1; console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };

if (!process.argv.includes("--check")) {
  const started = Date.now();
  const sent = await indexAll(db, true);
  console.log(`\n  Indexed ${sent.trials} studies and ${sent.passages} passages into ${host} in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
}

for (let i = 0; i < 120 && !elasticReady(db); i++) await new Promise((r) => setTimeout(r, 500));
const count = async (index: string) => (await elasticRequest("GET", `/${index}/_count`, undefined, 10000)).count as number;
const inDb = (sql: string) => (db.prepare(sql).get() as { c: number }).c;
check("every study in the database is in the index", (await count(TRIALS_INDEX)) === inDb("SELECT COUNT(*) c FROM trials"), `${await count(TRIALS_INDEX)} of ${inDb("SELECT COUNT(*) c FROM trials")}`);
check("every eligibility passage is in the index", (await count(PASSAGES_INDEX)) === inDb("SELECT COUNT(*) c FROM criteria"), `${await count(PASSAGES_INDEX)} of ${inDb("SELECT COUNT(*) c FROM criteria")}`);

const sample = (await elasticRequest("POST", `/${PASSAGES_INDEX}/_search`, { size: 1, query: { term: { source: "clinicaltrials.gov" } } }, 10000)).hits.hits[0]?._source ?? {};
check("a passage carries its source id and version metadata", Boolean(sample.source_id && sample.record_hash && sample.retrieved_at && Number.isInteger(sample.source_start)),
  `${sample.source_id}, hash ${String(sample.record_hash).slice(0, 10)}…, retrieved ${String(sample.retrieved_at).slice(0, 10)}, chars ${sample.source_start}-${sample.source_end}`);
const original = db.prepare("SELECT eligibility_text t FROM trials WHERE id = ?").get(sample.source_id) as { t: string } | undefined;
check("and its offsets point at exactly that text in the registry record", original?.t.slice(sample.source_start, sample.source_end) === sample.text);

const personal = JSON.stringify(await elasticRequest("GET", `/${TRIALS_INDEX},${PASSAGES_INDEX}/_mapping`, undefined, 10000));
check("no participant field exists in either index", !/participant|email|phone|display_name|contact/i.test(personal));

// The same title probes the engine evaluation uses: is the right record in the top ten?
const probes = db.prepare("SELECT id, brief_title t FROM trials WHERE is_fictional = 0 AND brief_title IS NOT NULL ORDER BY id LIMIT 40").all() as { id: string; t: string }[];
let elasticFound = 0, sqliteFound = 0, elasticMs = 0;
for (const probe of probes) {
  const filters = { text: probe.t.slice(0, 90), recruitingOnly: false, limit: 10 };
  const result = await searchAsync(filters);
  if (result.backend !== "elasticsearch") { check("Elasticsearch answered the probe", false, "fell back to SQLite"); break; }
  elasticMs += result.tookMs;
  if (result.hits.some((hit) => hit.trial.id === probe.id)) elasticFound += 1;
  if (search(filters).hits.some((hit) => hit.trial.id === probe.id)) sqliteFound += 1;
}
check(`finds the right study for ${probes.length} title searches`, elasticFound === probes.length, `Elasticsearch ${elasticFound}/${probes.length}, SQLite ${sqliteFound}/${probes.length}, avg ${Math.round(elasticMs / probes.length)}ms`);

const her2 = await searchAsync({ text: "HER2 positive metastatic", recruitingOnly: false, limit: 5 });
check("a criterion-level query returns studies with the matching passage", her2.backend === "elasticsearch" && her2.hits.some((hit) => hit.matchedCriterionIds.length > 0), her2.hits.slice(0, 2).map((hit) => hit.trial.id).join(", "));

console.log(failed ? `\n  ${failed} check(s) failed.\n` : "\n  Elasticsearch is serving search.\n");
process.exit(failed ? 1 : 0);
