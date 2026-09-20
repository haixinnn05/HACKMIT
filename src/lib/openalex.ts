import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Trial } from "@/lib/types";

const OPENALEX_API = "https://api.openalex.org/works";

export const OPENALEX_DATASET_URL = "https://registry.opendata.aws/openalex/";

const GENERIC_INTERVENTIONS = new Set([
  "none",
  "none (observational study)",
  "not applicable",
  "placebo",
  "soc",
  "standard of care",
]);

interface OpenAlexApiWork {
  id?: unknown;
  doi?: unknown;
  title?: unknown;
  display_name?: unknown;
  publication_year?: unknown;
  publication_date?: unknown;
  cited_by_count?: unknown;
  authorships?: unknown;
  primary_location?: unknown;
  open_access?: unknown;
  type?: unknown;
  primary_topic?: unknown;
  abstract_inverted_index?: unknown;
}

interface OpenAlexApiResponse {
  results?: unknown;
}

export interface OpenAlexWork {
  id: string;
  title: string;
  publicationYear: number | null;
  publicationDate: string | null;
  citedByCount: number;
  authors: string[];
  venue: string | null;
  doiUrl: string | null;
  isOpenAccess: boolean;
  openAccessUrl: string | null;
  isReview: boolean;
  /** The opening of the paper's own abstract, verbatim. Null when the publisher
   *  does not allow OpenAlex to redistribute it. */
  abstractExcerpt: string | null;
  topicId: string | null;
}

/** OpenAlex's own description of a research area. */
export interface OpenAlexTopic {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  field: string | null;
  worksCount: number;
}

export interface OpenAlexResearchResult {
  works: OpenAlexWork[];
  topic: OpenAlexTopic | null;
  query: string;
  matchKind: "trial_id" | "topic";
  fetchedAt: string;
  /** True when OpenAlex was unreachable and this is the copy saved on disk. */
  fromSnapshot: boolean;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function authorNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("author" in item)) return [];
    const author = item.author;
    if (!author || typeof author !== "object" || !("display_name" in author)) return [];
    return typeof author.display_name === "string" ? [author.display_name] : [];
  }).slice(0, 3);
}

function venueName(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("source" in value)) return null;
  const source = value.source;
  if (!source || typeof source !== "object" || !("display_name" in source)) return null;
  return typeof source.display_name === "string" ? source.display_name : null;
}

function openAccess(value: unknown): { isOpenAccess: boolean; url: string | null } {
  if (!value || typeof value !== "object") return { isOpenAccess: false, url: null };
  const isOpen = "is_oa" in value && value.is_oa === true;
  const url = "oa_url" in value && isHttpUrl(value.oa_url) ? value.oa_url : null;
  return { isOpenAccess: isOpen, url };
}

/**
 * OpenAlex stores abstracts as a word-to-positions index. Rebuild the text, then
 * keep the opening sentences. The excerpt is shown verbatim and never reworded.
 */
function abstractExcerpt(value: unknown, maxChars = 360): string | null {
  if (!value || typeof value !== "object") return null;
  const placed: [number, string][] = [];
  for (const [word, positions] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(positions)) continue;
    for (const position of positions) if (typeof position === "number") placed.push([position, word]);
  }
  if (placed.length < 12) return null;
  const text = placed.sort((a, b) => a[0] - b[0]).map(([, word]) => word).join(" ")
    .replace(/\s+/g, " ").replace(/^(abstract|background|purpose|introduction|objectives?)\s*[:.]?\s*/i, "").trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return sentenceEnd > 120 ? cut.slice(0, sentenceEnd + 1) : `${cut.slice(0, cut.lastIndexOf(" "))} ...`;
}

function topicIdOf(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  return typeof value.id === "string" ? value.id.split("/").pop() ?? null : null;
}

function normalizeWork(value: unknown): OpenAlexWork | null {
  if (!value || typeof value !== "object") return null;
  const work = value as OpenAlexApiWork;
  if (!isHttpUrl(work.id)) return null;

  const title = typeof work.title === "string"
    ? work.title
    : typeof work.display_name === "string"
      ? work.display_name
      : null;
  if (!title) return null;

  const oa = openAccess(work.open_access);
  return {
    id: work.id,
    title,
    publicationYear: typeof work.publication_year === "number" ? work.publication_year : null,
    publicationDate: typeof work.publication_date === "string" ? work.publication_date : null,
    citedByCount: typeof work.cited_by_count === "number" ? work.cited_by_count : 0,
    authors: authorNames(work.authorships),
    venue: venueName(work.primary_location),
    doiUrl: isHttpUrl(work.doi) ? work.doi : null,
    isOpenAccess: oa.isOpenAccess,
    openAccessUrl: oa.url,
    isReview: work.type === "review",
    abstractExcerpt: abstractExcerpt(work.abstract_inverted_index),
    topicId: topicIdOf(work.primary_topic),
  };
}

function usefulIntervention(name: string | null): name is string {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  if (GENERIC_INTERVENTIONS.has(normalized)) return false;
  // Trial drug codes are rarely useful topic searches until literature exists.
  if (/\d/.test(name) && /[-[\]]/.test(name)) return false;
  return /[a-z]{4}/i.test(name);
}

/** Build a public-data-only query. Participant passport fields never enter it. */
export function openAlexTopicQuery(trial: Trial): string {
  const condition = trial.conditions[0]?.trim() || "clinical trial";
  const intervention = trial.interventions
    .map((item) => item.name?.trim() ?? null)
    .find(usefulIntervention);
  return [condition, intervention].filter(Boolean).join(" ");
}

async function searchOpenAlex(query: string, filter?: string): Promise<OpenAlexWork[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": "4",
    select: [
      "id", "doi", "title", "display_name", "publication_year", "publication_date",
      "cited_by_count", "authorships", "primary_location", "open_access",
      "type", "primary_topic", "abstract_inverted_index",
    ].join(","),
  });
  if (filter) params.set("filter", filter);
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);

  const response = await fetch(`${OPENALEX_API}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozaic/0.1 (OpenAlex related-research lookup)",
    },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(6_000),
  });

  if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
  const body = await response.json() as OpenAlexApiResponse;
  if (!Array.isArray(body.results)) return [];
  return body.results.map(normalizeWork).filter((work): work is OpenAlexWork => work !== null);
}

async function fetchTopic(topicId: string): Promise<OpenAlexTopic | null> {
  const params = new URLSearchParams({ select: "id,display_name,description,keywords,field,works_count" });
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);
  const response = await fetch(`https://api.openalex.org/topics/${topicId}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "Mozaic/0.1 (OpenAlex topic lookup)" },
    next: { revalidate: 60 * 60 * 24 * 7 },
    signal: AbortSignal.timeout(6_000),
  });
  if (!response.ok) return null;
  const body = await response.json() as Record<string, unknown>;
  if (typeof body.description !== "string" || typeof body.display_name !== "string") return null;
  const field = body.field && typeof body.field === "object" && "display_name" in body.field ? body.field.display_name : null;
  return {
    id: topicId,
    name: body.display_name,
    description: body.description,
    keywords: Array.isArray(body.keywords) ? body.keywords.filter((k): k is string => typeof k === "string").slice(0, 8) : [],
    field: typeof field === "string" ? field : null,
    worksCount: typeof body.works_count === "number" ? body.works_count : 0,
  };
}

/* ------------------------------------------------------------------ snapshot */

const SNAPSHOT_DIR = path.join(process.cwd(), "data", "openalex");
const snapshotPath = (trialId: string) => path.join(SNAPSHOT_DIR, `${trialId.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);

function readSnapshot(trialId: string): OpenAlexResearchResult | null {
  try { return JSON.parse(readFileSync(snapshotPath(trialId), "utf8")) as OpenAlexResearchResult; } catch { return null; }
}

function writeSnapshot(trialId: string, result: OpenAlexResearchResult) {
  try {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(snapshotPath(trialId), `${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.warn("[openalex] could not save snapshot:", error);
  }
}

/**
 * Background research for one trial.
 *
 * Publications that cite the trial identifier come first. New studies usually
 * have none, so the fallback is a topic search that prefers review articles with
 * abstracts, because reviews are the papers written to explain a field. The
 * commonest research topic among the results supplies OpenAlex's own
 * plain-language description of the area.
 *
 * Every successful lookup is saved to data/openalex/. If OpenAlex cannot be
 * reached, that saved copy is served and labelled with its date, so the demo
 * does not depend on the network.
 */
export async function getOpenAlexResearch(trial: Trial): Promise<OpenAlexResearchResult> {
  const topicQuery = openAlexTopicQuery(trial);
  try {
    const [identifierWorks, reviews] = await Promise.all([
      trial.isFictional ? Promise.resolve([]) : searchOpenAlex(trial.id),
      searchOpenAlex(topicQuery, "has_abstract:true,type:review"),
    ]);
    // Too few reviews for a narrow topic: widen to any paper with an abstract.
    const topicWorks = reviews.length >= 3 ? reviews : [...reviews, ...(await searchOpenAlex(topicQuery, "has_abstract:true"))]
      .filter((work, index, all) => all.findIndex((other) => other.id === work.id) === index);

    const exact = identifierWorks.length > 0;
    const works = (exact ? identifierWorks : topicWorks).slice(0, 4);

    const counts = new Map<string, number>();
    for (const work of [...works, ...topicWorks]) if (work.topicId) counts.set(work.topicId, (counts.get(work.topicId) ?? 0) + 1);
    const topTopic = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    const result: OpenAlexResearchResult = {
      works,
      topic: topTopic ? await fetchTopic(topTopic).catch(() => null) : null,
      query: exact ? trial.id : topicQuery,
      matchKind: exact ? "trial_id" : "topic",
      fetchedAt: new Date().toISOString(),
      fromSnapshot: false,
    };
    writeSnapshot(trial.id, result);
    return result;
  } catch (error) {
    const saved = readSnapshot(trial.id);
    if (saved) return { ...saved, fromSnapshot: true };
    throw error;
  }
}
