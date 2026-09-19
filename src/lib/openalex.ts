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
}

export interface OpenAlexResearchResult {
  works: OpenAlexWork[];
  query: string;
  matchKind: "trial_id" | "topic";
  fetchedAt: string;
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

async function searchOpenAlex(query: string): Promise<OpenAlexWork[]> {
  const params = new URLSearchParams({
    search: query,
    "per-page": "4",
    select: [
      "id", "doi", "title", "display_name", "publication_year", "publication_date",
      "cited_by_count", "authorships", "primary_location", "open_access",
    ].join(","),
  });
  if (process.env.OPENALEX_MAILTO) params.set("mailto", process.env.OPENALEX_MAILTO);

  const response = await fetch(`${OPENALEX_API}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "TrialPassport/0.1 (OpenAlex related-research lookup)",
    },
    next: { revalidate: 60 * 60 * 24 },
    signal: AbortSignal.timeout(6_000),
  });

  if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`);
  const body = await response.json() as OpenAlexApiResponse;
  if (!Array.isArray(body.results)) return [];
  return body.results.map(normalizeWork).filter((work): work is OpenAlexWork => work !== null);
}

/**
 * Prefer publications that mention the trial identifier. New studies often have
 * none, so a topic search supplies clearly-labelled background research instead.
 */
export async function getOpenAlexResearch(trial: Trial): Promise<OpenAlexResearchResult> {
  const topicQuery = openAlexTopicQuery(trial);
  const [identifierWorks, topicWorks] = await Promise.all([
    searchOpenAlex(trial.id),
    searchOpenAlex(topicQuery),
  ]);

  const exact = identifierWorks.length > 0;
  return {
    works: (exact ? identifierWorks : topicWorks).slice(0, 4),
    query: exact ? trial.id : topicQuery,
    matchKind: exact ? "trial_id" : "topic",
    fetchedAt: new Date().toISOString(),
  };
}
