import type Database from "better-sqlite3";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Elasticsearch as the retrieval backend.
 *
 * Two indices mirror the two rankings the search already fuses:
 *
 *   mozaic-trials    one document per public registry record (and per study a
 *                    research team posted), with its searchable text
 *   mozaic-passages  one document per eligibility criterion: a passage of the
 *                    public record, with the character offsets it was cut from
 *
 * Every document carries its source id and version metadata next to the search
 * text: the registry id, the source URL, when the record was retrieved, the hash
 * of the record it came from, and the registry's own last-update date. A hit can
 * therefore always be traced to the exact version of the exact record it is
 * quoting, and a stale index can be told from a fresh one.
 *
 * Nothing about a participant is ever indexed. The indices hold public study
 * text only, and a query carries search words and nothing else.
 *
 * Configure with ELASTICSEARCH_URL, plus ELASTICSEARCH_API_KEY (Elastic Cloud)
 * or ELASTICSEARCH_USERNAME and ELASTICSEARCH_PASSWORD. Without a URL the app
 * uses SQLite FTS5, and it falls back to it whenever Elasticsearch does not
 * answer in time.
 */

export const TRIALS_INDEX = process.env.ELASTICSEARCH_INDEX_PREFIX ? `${process.env.ELASTICSEARCH_INDEX_PREFIX}-trials` : "mozaic-trials";
export const PASSAGES_INDEX = process.env.ELASTICSEARCH_INDEX_PREFIX ? `${process.env.ELASTICSEARCH_INDEX_PREFIX}-passages` : "mozaic-passages";

export function elasticConfigured(): boolean {
  const url = process.env.ELASTICSEARCH_URL;
  return Boolean(url && /^https?:\/\//.test(url));
}

function headers(contentType = "application/json"): Record<string, string> {
  const out: Record<string, string> = { "content-type": contentType };
  if (process.env.ELASTICSEARCH_API_KEY) out.authorization = `ApiKey ${process.env.ELASTICSEARCH_API_KEY}`;
  else if (process.env.ELASTICSEARCH_USERNAME) {
    out.authorization = `Basic ${Buffer.from(`${process.env.ELASTICSEARCH_USERNAME}:${process.env.ELASTICSEARCH_PASSWORD ?? ""}`).toString("base64")}`;
  }
  return out;
}

export async function elasticRequest(method: string, path: string, body?: unknown, timeoutMs = 2500, contentType?: string): Promise<any> {
  const base = process.env.ELASTICSEARCH_URL!.replace(/\/+$/, "");
  const response = await fetch(`${base}${path}`, {
    method, headers: headers(contentType),
    body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Elasticsearch ${method} ${path.split("?")[0]} -> ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/* ------------------------------------------------------------------ querying */

export interface ElasticRankings {
  trialRanking: { id: string; rank: number }[];
  criterionRanking: { trial_id: string; criterion_id: string; rank: number }[];
}

/**
 * The same two rankings the SQLite backend produces, in the same shape. Scores
 * are negated because the fusion step was written for SQLite's bm25, where a
 * better match is more negative.
 *
 * Field boosts mirror the FTS5 column weights, and passages are collapsed by
 * study inside Elasticsearch so a long eligibility section cannot fill the
 * result set on repetition alone.
 */
export async function elasticRankings(terms: string[], limit: number): Promise<ElasticRankings> {
  const query = terms.join(" ");
  const [trials, passages] = await Promise.all([
    elasticRequest("POST", `/${TRIALS_INDEX}/_search`, {
      size: limit, _source: false, track_total_hits: false,
      query: { multi_match: { query, type: "most_fields", operator: "or", fields: ["title^3", "summary^0.7", "conditions^1", "interventions^2", "sponsor^4"] } },
    }),
    elasticRequest("POST", `/${PASSAGES_INDEX}/_search`, {
      size: limit, _source: false, track_total_hits: false,
      query: { match: { text: { query, operator: "or" } } },
      collapse: { field: "trial_id" },
    }),
  ]);
  return {
    trialRanking: (trials?.hits?.hits ?? []).map((hit: any) => ({ id: hit._id, rank: -hit._score })),
    criterionRanking: (passages?.hits?.hits ?? []).map((hit: any) => ({ trial_id: hit.fields?.trial_id?.[0], criterion_id: hit._id, rank: -hit._score }))
      .filter((row: any) => row.trial_id),
  };
}

/* ------------------------------------------------------------------ indexing */

const TEXT = { type: "text", analyzer: "english" } as const;
const KEYWORD = { type: "keyword" } as const;
// Version metadata, identical on both indices so a passage can be tied to the record version it was cut from.
const PROVENANCE = {
  source: KEYWORD,             // "clinicaltrials.gov" or "mozaic_site_post"
  source_id: KEYWORD,          // NCT id, or the id of a study posted in the app
  source_url: { type: "keyword", index: false },
  record_hash: KEYWORD,        // hash of the registry record this text came from
  retrieved_at: { type: "date" },
  last_update_post_date: { type: "date", ignore_malformed: true },
  indexed_at: { type: "date" },
};

const MAPPINGS = {
  [TRIALS_INDEX]: { properties: { ...PROVENANCE, title: TEXT, summary: TEXT, conditions: TEXT, interventions: TEXT, sponsor: TEXT, overall_status: KEYWORD, phases: KEYWORD } },
  [PASSAGES_INDEX]: { properties: { ...PROVENANCE, trial_id: KEYWORD, role: KEYWORD, order_index: { type: "integer" }, source_start: { type: "integer" }, source_end: { type: "integer" }, text: TEXT } },
};

export async function ensureIndices(recreate = false) {
  for (const [index, mappings] of Object.entries(MAPPINGS)) {
    if (recreate) await elasticRequest("DELETE", `/${index}?ignore_unavailable=true`, undefined, 20000);
    const exists = await fetch(`${process.env.ELASTICSEARCH_URL!.replace(/\/+$/, "")}/${index}`, { method: "HEAD", headers: headers(), signal: AbortSignal.timeout(10000) });
    if (exists.status === 404) {
      await elasticRequest("PUT", `/${index}`, { settings: { number_of_shards: 1, number_of_replicas: 0 }, mappings }, 20000);
    }
  }
}

const parseList = (value: unknown): any[] => { try { const v = JSON.parse(String(value ?? "[]")); return Array.isArray(v) ? v : []; } catch { return []; } };

/** The bulk lines for one study and its passages, read straight from the database the app runs on. */
function bulkLinesForStudy(db: Database.Database, id: string, indexedAt: string): string[] {
  const row = db.prepare("SELECT * FROM trials WHERE id = ?").get(id) as any;
  if (!row) return [];
  const provenance = {
    source: row.is_fictional ? "mozaic_site_post" : "clinicaltrials.gov",
    source_id: row.id, source_url: row.source_url ?? null, record_hash: row.record_hash ?? null,
    retrieved_at: row.retrieved_at ?? null, last_update_post_date: row.last_update_post_date ?? null, indexed_at: indexedAt,
  };
  const lines = [
    JSON.stringify({ index: { _index: TRIALS_INDEX, _id: row.id } }),
    JSON.stringify({
      ...provenance,
      title: [row.brief_title, row.official_title, row.acronym].filter(Boolean).join(" "),
      summary: [row.brief_summary, row.detailed_description].filter(Boolean).join(" "),
      conditions: [...parseList(row.conditions), ...parseList(row.keywords)].join(" "),
      interventions: parseList(row.interventions).map((i) => `${i.type ?? ""} ${i.name ?? ""}`).join(" "),
      sponsor: row.lead_sponsor ?? "", overall_status: row.overall_status ?? null, phases: parseList(row.phases),
    }),
  ];
  for (const criterion of db.prepare("SELECT * FROM criteria WHERE trial_id = ? ORDER BY order_index").all(id) as any[]) {
    lines.push(
      JSON.stringify({ index: { _index: PASSAGES_INDEX, _id: criterion.id } }),
      JSON.stringify({ ...provenance, trial_id: id, role: criterion.role, order_index: criterion.order_index, source_start: criterion.source_start, source_end: criterion.source_end, text: criterion.text }),
    );
  }
  return lines;
}

async function bulk(lines: string[]) {
  if (lines.length === 0) return;
  const result = await elasticRequest("POST", "/_bulk?refresh=wait_for", lines.join("\n") + "\n", 60000, "application/x-ndjson");
  if (result?.errors) {
    const first = result.items.map((item: any) => item.index?.error).find(Boolean);
    throw new Error(`Elasticsearch bulk indexing reported errors: ${JSON.stringify(first).slice(0, 300)}`);
  }
}

/** Index everything. Returns how many studies and passages were sent. */
export async function indexAll(db: Database.Database, recreate = true): Promise<{ trials: number; passages: number }> {
  await ensureIndices(recreate);
  const indexedAt = new Date().toISOString();
  const ids = (db.prepare("SELECT id FROM trials ORDER BY id").all() as { id: string }[]).map((row) => row.id);
  let passages = 0;
  for (let start = 0; start < ids.length; start += 50) {
    const lines = ids.slice(start, start + 50).flatMap((id) => bulkLinesForStudy(db, id, indexedAt));
    passages += lines.length / 2;
    await bulk(lines);
  }
  return { trials: ids.length, passages: passages - ids.length };
}

/** Keep the index in step when a research team posts, pauses or removes a study. Never throws into the caller. */
export async function syncStudy(db: Database.Database, id: string): Promise<void> {
  if (!elasticConfigured()) return;
  try {
    await ensureIndices(false);
    await elasticRequest("POST", `/${PASSAGES_INDEX}/_delete_by_query?refresh=true&conflicts=proceed`, { query: { term: { trial_id: id } } }, 10000);
    const lines = bulkLinesForStudy(db, id, new Date().toISOString());
    if (lines.length) await bulk(lines);
    else await elasticRequest("DELETE", `/${TRIALS_INDEX}/_doc/${encodeURIComponent(id)}?refresh=true`, undefined, 10000).catch(() => {});
  } catch (error) {
    console.warn("[search] could not sync study to Elasticsearch; SQLite remains correct:", error);
  }
}
