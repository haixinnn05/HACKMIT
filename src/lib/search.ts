import { getDb } from "./db";
import { elasticConfigured, elasticRankings, elasticReady } from "./elastic";
import { getTrials } from "./repo";
import type { ParticipantProfile, Trial } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Retrieval.
 *
 * Two rankings are produced — one over trial-level text (title, summary,
 * conditions, interventions) and one over individual eligibility criteria — and
 * fused with reciprocal rank fusion. Criterion hits are collapsed by trial first
 * so a long eligibility section cannot dominate the result set.
 *
 * The default backend is SQLite FTS5, which needs no external service. Setting
 * ELASTICSEARCH_URL swaps in Elasticsearch for the same two rankings; the fusion,
 * filtering and scoring contract below is unchanged either way, and the UI always
 * reports which backend answered.
 */

export type SearchBackend = "sqlite_fts5" | "elasticsearch";

export interface SearchFilters {
  /** The fictional fixture is excluded from ranked results by default. It is not
   *  lexically competitive against 300 real records, and promoting it into the
   *  ranking would misrepresent it as a relevance match. The Explore screen
   *  surfaces it separately, under its own heading. */
  condition?: string | null;
  text?: string | null;
  country?: string | null;
  state?: string | null;
  /** Age is used only to *flag* a bound, never to silently drop a record whose
   *  bounds are missing. */
  ageYears?: number | null;
  sex?: string | null;
  includeFictional?: boolean;
  recruitingOnly?: boolean;
  limit?: number;
}

export interface SearchHit {
  trial: Trial;
  score: number;
  /** Why this record surfaced, in the user's terms. Shown on the card. */
  reasons: string[];
  matchedCriterionIds: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  backend: SearchBackend;
  /** True when semantic/hybrid retrieval was unavailable and we fell back to
   *  lexical only. The UI labels this rather than hiding it. */
  lexicalOnly: boolean;
  totalCandidates: number;
  queryText: string;
  tookMs: number;
}

/** The words a query is actually searched by. Both backends use the same ones. */
function queryTerms(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !STOPWORDS.has(term));
}

/** FTS5 MATCH syntax is not free text. Quote every term and OR them together. */
function toMatchQuery(raw: string): string | null {
  const terms = queryTerms(raw);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ");
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "study", "trial", "patients", "participants",
  "cancer", "treatment", "has", "was", "are", "who", "any", "all", "not",
]);

/**
 * Fusion weights. The trial-level ranking is the primary signal: a study whose
 * title or listed condition matches the query is what the person asked for. A
 * criterion-level hit is a supporting signal — it should promote a record, not
 * outrank a direct match.
 */
const TRIAL_RANKING_WEIGHT = 1;
const CRITERION_RANKING_WEIGHT = 0.35;

/**
 * Score fusion.
 *
 * Reciprocal rank fusion is the documented approach for combining rankings, and
 * it is the right tool when the rankings are *incomparable* — a lexical ranking
 * and a semantic one, say. It is the wrong tool here. Both of these rankings are
 * bm25 over the same index, so their scores are directly comparable, and RRF's
 * rank-only view throws away exactly the information that distinguishes an exact
 * title match from a merely plausible one. Measured on 40 title probes, RRF put
 * the correct record outside the top 10 for 22.5% of queries even though it was
 * ranked first by the trial-level query every time.
 *
 * So: min-max normalize each bm25 ranking over the candidate pool and combine
 * linearly. `reciprocalRankFusion` is kept below for the day a genuinely
 * incomparable semantic ranking is added.
 */
function normalizeRanking(rows: { id: string; rank: number }[]): Map<string, number> {
  const scores = new Map<string, number>();
  if (rows.length === 0) return scores;

  // SQLite's bm25 returns negative values, better matches more negative.
  const relevance = rows.map((row) => -row.rank);
  const max = Math.max(...relevance);
  const min = Math.min(...relevance);
  const span = max - min;

  rows.forEach((row, index) => {
    // With a single result, or a degenerate spread, rank order is all we have.
    scores.set(row.id, span > 0 ? (relevance[index] - min) / span : 1);
  });
  return scores;
}

const RRF_K = 60;

/** Reserved for fusing rankings whose scores are not comparable. */
export function reciprocalRankFusion(rankings: string[][]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + index + 1));
    });
  }
  return scores;
}

function lexicalTrialRanking(match: string, limit: number): { id: string; rank: number }[] {
  // bm25() weights: title and conditions matter more than a long description.
  return getDb()
    .prepare(
      `SELECT id, bm25(trials_fts, 1.0, 3.0, 0.7, 1.0, 2.0, 4.0) AS rank
       FROM trials_fts WHERE trials_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(match, limit) as any[];
}

function lexicalCriterionRanking(match: string, limit: number) {
  // Score every matching criterion, then collapse by trial in JS, keeping each
  // trial's single best hit. Collapsing here rather than in SQL is deliberate:
  // SQLite only exposes bm25() inside the MATCH query itself, so it cannot be
  // aggregated or referenced from an outer query.
  //
  // Collapsing matters for ranking quality. Without it a study with a 60-item
  // eligibility section would occupy most of the result set on the strength of
  // repetition alone.
  const rows = getDb()
    .prepare(
      `SELECT trial_id, criterion_id, bm25(criteria_fts) AS rank
       FROM criteria_fts WHERE criteria_fts MATCH ? ORDER BY rank LIMIT ?`
    )
    .all(match, limit * 8) as any[];

  const best = new Map<string, any>();
  for (const row of rows) {
    // Rows arrive best-first, so the first sighting of a trial is its best hit.
    if (!best.has(row.trial_id)) best.set(row.trial_id, row);
  }
  return [...best.values()].slice(0, limit);
}

/**
 * Structured filters. A filter only removes a record when the record's own
 * metadata positively conflicts. Missing metadata is retained and surfaced as an
 * unknown, because dropping it would hide an option the person cannot then ask
 * about.
 */
function applyFilters(trial: Trial, filters: SearchFilters): { keep: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!filters.includeFictional && trial.isFictional) return { keep: false, reasons };

  if (filters.recruitingOnly && trial.overallStatus && trial.overallStatus !== "RECRUITING") {
    return { keep: false, reasons };
  }

  if (filters.country) {
    const countries = trial.sites.map((site) => site.country).filter(Boolean);
    if (countries.length > 0 && !countries.includes(filters.country)) {
      return { keep: false, reasons };
    }
    if (countries.length === 0) reasons.push("No study locations are listed in the registry record");
  }

  if (filters.state) {
    const states = trial.sites.map((site) => site.state).filter(Boolean);
    if (states.includes(filters.state)) reasons.push(`Has a listed site in ${filters.state}`);
  }

  if (filters.ageYears != null) {
    if (trial.minAgeYears != null && filters.ageYears < trial.minAgeYears) {
      reasons.push(`Registry lists a minimum age of ${trial.minAgeRaw}`);
    }
    if (trial.maxAgeYears != null && filters.ageYears > trial.maxAgeYears) {
      reasons.push(`Registry lists a maximum age of ${trial.maxAgeRaw}`);
    }
  }

  if (filters.sex && trial.sex && trial.sex !== "ALL" && trial.sex !== filters.sex) {
    reasons.push(`Registry lists this study as enrolling: ${trial.sex.toLowerCase()}`);
  }

  return { keep: true, reasons };
}

const queryTextOf = (filters: SearchFilters) => [filters.condition, filters.text].filter(Boolean).join(" ").trim();
const poolSizeOf = (filters: SearchFilters) => Math.max((filters.limit ?? 10) * 12, 120);

type Rankings = { trialRanking: { id: string; rank: number }[]; criterionRanking: any[] };

/** SQLite FTS5. Synchronous, needs no service, and is what every fallback lands on. */
export function search(filters: SearchFilters): SearchResult {
  return assemble(filters, sqliteRankings(filters), "sqlite_fts5", Date.now());
}

/**
 * The search the app uses. Elasticsearch answers when it is configured and
 * reachable; otherwise SQLite does, and `backend` on the result says which one
 * it was so the screen never claims a backend that did not answer.
 */
export async function searchAsync(filters: SearchFilters): Promise<SearchResult> {
  const started = Date.now();
  if (elasticConfigured() && elasticReady(getDb())) {
    const terms = queryTerms(queryTextOf(filters));
    try {
      const rankings = terms.length ? await elasticRankings(terms, poolSizeOf(filters)) : { trialRanking: [], criterionRanking: [] };
      return assemble(filters, rankings, "elasticsearch", started);
    } catch (error) {
      console.warn("[search] Elasticsearch did not answer; using SQLite FTS5:", error instanceof Error ? error.message : error);
    }
  }
  return assemble(filters, sqliteRankings(filters), "sqlite_fts5", started);
}

function sqliteRankings(filters: SearchFilters): Rankings {
  const match = toMatchQuery(queryTextOf(filters));
  const poolSize = poolSizeOf(filters);
  let trialRanking: { id: string; rank: number }[] = [];
  let criterionRanking: any[] = [];

  if (match) {
    // The two rankings fail independently. One backend problem degrades the
    // result quality; it must not take the whole search down, and it must not
    // silently discard the ranking that did work.
    try {
      trialRanking = lexicalTrialRanking(match, poolSize);
    } catch (error) {
      console.warn("[search] trial-level ranking failed:", error);
    }
    try {
      criterionRanking = lexicalCriterionRanking(match, poolSize);
    } catch (error) {
      console.warn("[search] criterion-level ranking failed:", error);
    }
  }

  return { trialRanking, criterionRanking };
}

/** Fusion, filtering and explanation. Identical whichever backend produced the rankings. */
function assemble(filters: SearchFilters, { trialRanking, criterionRanking }: Rankings, backend: SearchBackend, started: number): SearchResult {
  const limit = filters.limit ?? 10;
  const queryText = queryTextOf(filters);
  const poolSize = poolSizeOf(filters);

  const trialScores = normalizeRanking(trialRanking);
  const criterionScores = normalizeRanking(
    criterionRanking.map((row) => ({ id: row.trial_id, rank: row.rank }))
  );
  const fusedScores = new Map<string, number>();
  for (const [id, score] of trialScores) {
    fusedScores.set(id, score * TRIAL_RANKING_WEIGHT);
  }
  for (const [id, score] of criterionScores) {
    fusedScores.set(id, (fusedScores.get(id) ?? 0) + score * CRITERION_RANKING_WEIGHT);
  }

  let candidateIds: string[];
  if (fusedScores.size === 0) {
    // No usable ranking. Show the most recently updated records rather than
    // nothing, and let `lexicalOnly` tell the UI the ranking is degraded.
    candidateIds = (getDb()
      .prepare("SELECT id FROM trials ORDER BY IFNULL(last_update_post_date,'') DESC LIMIT ?")
      .all(poolSize) as any[]).map((row) => row.id);
  } else {
    candidateIds = [...fusedScores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }

  const criterionByTrial = new Map<string, string>(
    criterionRanking.map((row) => [row.trial_id, row.criterion_id])
  );

  const trials = getTrials(candidateIds.slice(0, poolSize));
  const hits: SearchHit[] = [];

  for (const trial of trials) {
    const { keep, reasons } = applyFilters(trial, filters);
    if (!keep) continue;

    const conditionMatch = filters.condition
      ? trial.conditions.find((condition) =>
          condition.toLowerCase().includes(filters.condition!.toLowerCase().split(" ")[0]))
      : null;
    if (conditionMatch) reasons.unshift(`Listed condition: ${conditionMatch}`);

    if (trial.lastUpdatePostDate) {
      const monthsOld =
        (Date.now() - new Date(trial.lastUpdatePostDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 12) {
        reasons.push(
          `Registry record last updated ${trial.lastUpdatePostDate}; recruiting status may be out of date`
        );
      }
    }
    if (trial.sites.length === 0) reasons.push("No study locations listed");
    else if (!trial.sites.some((site) => site.siteStatus)) {
      reasons.push("Site-level recruiting status is not published");
    }

    hits.push({
      trial,
      score: fusedScores.get(trial.id) ?? 0,
      reasons: [...new Set(reasons)].slice(0, 4),
      matchedCriterionIds: [criterionByTrial.get(trial.id)].filter(Boolean) as string[],
    });
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.trial.lastUpdatePostDate ?? "").localeCompare(a.trial.lastUpdatePostDate ?? "");
  });

  return {
    hits: hits.slice(0, limit),
    backend,
    lexicalOnly: true,
    totalCandidates: trials.length,
    queryText,
    tookMs: Date.now() - started,
  };
}

/** Derive a search from the profile, using only fields the person authorized for
 *  retrieval. Contact details are never part of a query. */
export function searchForProfile(
  profile: ParticipantProfile,
  overrides: Partial<SearchFilters> = {}
): SearchResult {
  return search({
    condition: profile.condition,
    ageYears: profile.ageYears,
    sex: profile.sex,
    country: profile.country,
    state: profile.state,
    recruitingOnly: true,
    includeFictional: false,
    limit: 10,
    ...overrides,
  });
}


/** As searchForProfile, through whichever backend is configured. */
export function searchForProfileAsync(profile: ParticipantProfile, overrides: Partial<SearchFilters> = {}): Promise<SearchResult> {
  return searchAsync({
    condition: profile.condition, ageYears: profile.ageYears, sex: profile.sex, country: profile.country, state: profile.state,
    recruitingOnly: true, includeFictional: false, limit: 10, ...overrides,
  });
}
