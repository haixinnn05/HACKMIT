#!/usr/bin/env node
/**
 * Mozaic — ClinicalTrials.gov ingestion.
 *
 * Fetches public registry records, normalizes them into the product's Trial /
 * Site / Criterion shape, and writes a reproducible snapshot plus a manifest
 * recording the exact query, retrieval time, record count and content hashes.
 *
 * The app never calls the registry at request time. It reads this snapshot, so
 * every demo is reproducible offline and every rendered fact has a retrieval
 * date the UI can show.
 *
 * Usage: node scripts/ingest.mjs [--condition "breast cancer"] [--max 300]
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://clinicaltrials.gov/api/v2/studies";
const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "data", "snapshot");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const CONDITION = flag("condition", "breast cancer");
const MAX_RECORDS = Number(flag("max", "300"));
const PAGE_SIZE = 100;

/** Fields we rely on. Requesting them explicitly keeps payloads small and makes
 *  the contract with the API visible in one place. */
const FIELDS = [
  "protocolSection.identificationModule",
  "protocolSection.statusModule",
  "protocolSection.sponsorCollaboratorsModule",
  "protocolSection.descriptionModule",
  "protocolSection.conditionsModule",
  "protocolSection.designModule",
  "protocolSection.armsInterventionsModule",
  "protocolSection.outcomesModule",
  "protocolSection.eligibilityModule",
  "protocolSection.contactsLocationsModule",
  "hasResults",
].join("|");

const sha256 = (value) =>
  createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

/** "18 Years" / "6 Months" / "30 Days" -> age in years. Unparseable -> null,
 *  which the product treats as unknown rather than unbounded. */
function parseAgeToYears(raw) {
  if (!raw || typeof raw !== "string") return null;
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(year|month|week|day|hour|minute)s?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const perYear = { year: 1, month: 12, week: 52, day: 365, hour: 8760, minute: 525600 }[unit];
  return Math.round((value / perYear) * 1000) / 1000;
}

/**
 * Split free-text eligibility into individual criteria, preserving inclusion vs
 * exclusion role and the character offsets into the original text so the UI can
 * highlight the exact supporting span.
 */
function splitCriteria(eligibilityText) {
  if (!eligibilityText) return [];
  const text = eligibilityText.replace(/\r\n/g, "\n");
  const criteria = [];
  let role = "unspecified";
  let cursor = 0;

  for (const rawLine of text.split("\n")) {
    const lineStart = cursor;
    cursor += rawLine.length + 1; // +1 for the newline we split on

    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.replace(/[:*\-•\s]/g, "").toLowerCase();
    if (/^inclusioncriteria/.test(heading)) { role = "inclusion"; continue; }
    if (/^exclusioncriteria/.test(heading)) { role = "exclusion"; continue; }
    if (/^(keyinclusion|maininclusion)/.test(heading)) { role = "inclusion"; continue; }
    if (/^(keyexclusion|mainexclusion)/.test(heading)) { role = "exclusion"; continue; }

    // Strip a leading bullet/number marker but keep the offset accurate.
    const marker = line.match(/^(?:[-*•‣◦]|\d+[.)]|[a-z][.)])\s+/i);
    const bodyOffsetInLine = marker ? marker[0].length : 0;
    const body = line.slice(bodyOffsetInLine);
    if (body.length < 4) continue;

    const indentInRaw = rawLine.length - rawLine.trimStart().length;
    const start = lineStart + indentInRaw + bodyOffsetInLine;

    criteria.push({
      role,
      text: body,
      sourceStart: start,
      sourceEnd: start + body.length,
      // Logical grouping: a criterion listing alternatives with "or" is a
      // disjunction, so failing one branch is not a conflict.
      logic: /\bor\b/i.test(body) && !/\band\b/i.test(body) ? "any_of" : "all_of",
    });
  }
  return criteria;
}

function normalizeStudy(study, retrievedAt) {
  const p = study.protocolSection ?? {};
  const id = p.identificationModule ?? {};
  const status = p.statusModule ?? {};
  const design = p.designModule ?? {};
  const elig = p.eligibilityModule ?? {};
  const contacts = p.contactsLocationsModule ?? {};
  const desc = p.descriptionModule ?? {};

  const eligibilityText = elig.eligibilityCriteria ?? "";

  const locations = (contacts.locations ?? []).map((loc, index) => ({
    id: `${id.nctId}-site-${index}`,
    facility: loc.facility ?? null,
    city: loc.city ?? null,
    state: loc.state ?? null,
    country: loc.country ?? null,
    zip: loc.zip ?? null,
    // Site-level recruiting status is frequently absent. Absence is reported as
    // unknown; it is never assumed to match the study-level status.
    siteStatus: loc.status ?? null,
    lat: loc.geoPoint?.lat ?? null,
    lon: loc.geoPoint?.lon ?? null,
    hasContact: Boolean(loc.contacts?.length),
  }));

  return {
    nctId: id.nctId,
    briefTitle: id.briefTitle ?? null,
    officialTitle: id.officialTitle ?? null,
    acronym: id.acronym ?? null,
    leadSponsor: p.sponsorCollaboratorsModule?.leadSponsor?.name ?? null,
    sponsorClass: p.sponsorCollaboratorsModule?.leadSponsor?.class ?? null,
    overallStatus: status.overallStatus ?? null,
    studyFirstPostDate: status.studyFirstPostDateStruct?.date ?? null,
    lastUpdatePostDate: status.lastUpdatePostDateStruct?.date ?? null,
    startDate: status.startDateStruct?.date ?? null,
    completionDate: status.completionDateStruct?.date ?? null,
    briefSummary: desc.briefSummary ?? null,
    detailedDescription: desc.detailedDescription ?? null,
    conditions: p.conditionsModule?.conditions ?? [],
    keywords: p.conditionsModule?.keywords ?? [],
    studyType: design.studyType ?? null,
    phases: design.phases ?? [],
    enrollmentCount: design.enrollmentInfo?.count ?? null,
    enrollmentType: design.enrollmentInfo?.type ?? null,
    allocation: design.designInfo?.allocation ?? null,
    masking: design.designInfo?.maskingInfo?.masking ?? null,
    interventions: (p.armsInterventionsModule?.interventions ?? []).map((i) => ({
      type: i.type ?? null,
      name: i.name ?? null,
    })),
    primaryOutcomes: (p.outcomesModule?.primaryOutcomes ?? []).map((o) => ({
      measure: o.measure ?? null,
      timeFrame: o.timeFrame ?? null,
    })),
    eligibilityText,
    criteria: splitCriteria(eligibilityText),
    minAgeRaw: elig.minimumAge ?? null,
    maxAgeRaw: elig.maximumAge ?? null,
    minAgeYears: parseAgeToYears(elig.minimumAge),
    maxAgeYears: parseAgeToYears(elig.maximumAge),
    sex: elig.sex ?? null,
    healthyVolunteers: elig.healthyVolunteers ?? null,
    stdAges: elig.stdAges ?? [],
    locations,
    centralContacts: (contacts.centralContacts ?? []).length,
    hasResults: Boolean(study.hasResults),
    sourceUrl: `https://clinicaltrials.gov/study/${id.nctId}`,
    retrievedAt,
    recordHash: sha256(study),
  };
}

async function fetchPage(pageToken) {
  const url = new URL(API);
  url.searchParams.set("query.cond", CONDITION);
  url.searchParams.set("filter.overallStatus", "RECRUITING|NOT_YET_RECRUITING");
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("pageSize", String(PAGE_SIZE));
  url.searchParams.set("countTotal", "true");
  url.searchParams.set("format", "json");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  // Retry transient failures with backoff; honor the provider's rate limits.
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "Mozaic/0.1 (HackMIT prototype)" },
      });
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`transient HTTP ${response.status}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      return { body: await response.json(), url: url.toString() };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function main() {
  const retrievedAt = new Date().toISOString();
  const trials = [];
  const queries = [];
  let pageToken;
  let totalAvailable = null;

  while (trials.length < MAX_RECORDS) {
    const { body, url } = await fetchPage(pageToken);
    queries.push(url);
    if (totalAvailable === null) totalAvailable = body.totalCount ?? null;

    const studies = body.studies ?? [];
    if (studies.length === 0) break;

    for (const study of studies) {
      const normalized = normalizeStudy(study, retrievedAt);
      if (normalized.nctId) trials.push(normalized);
    }

    pageToken = body.nextPageToken;
    if (!pageToken) break;
    process.stdout.write(`\r  fetched ${trials.length} records…`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  process.stdout.write("\r");

  const kept = trials.slice(0, MAX_RECORDS);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path.join(OUT_DIR, "trials.json"), JSON.stringify(kept, null, 2));

  const withCriteria = kept.filter((t) => t.criteria.length > 0).length;
  const withSiteContact = kept.filter((t) => t.locations.some((l) => l.hasContact)).length;
  const withSiteStatus = kept.filter((t) => t.locations.some((l) => l.siteStatus)).length;

  const manifest = {
    source: "ClinicalTrials.gov API v2",
    license: "ClinicalTrials.gov terms of use; records are public U.S. registry data.",
    condition: CONDITION,
    queries,
    retrievedAt,
    recordCount: kept.length,
    totalAvailableAtQueryTime: totalAvailable,
    contentHash: sha256(kept.map((t) => t.recordHash).join("")),
    // Missingness is a product-visible fact, not a defect to hide. The Access
    // Gaps view reads these denominators directly.
    coverage: {
      recordsWithParsedCriteria: withCriteria,
      recordsWithAnySiteContact: withSiteContact,
      recordsWithAnySiteRecruitingStatus: withSiteStatus,
      recordsWithNoLocations: kept.filter((t) => t.locations.length === 0).length,
    },
  };
  await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`Snapshot written to data/snapshot/`);
  console.log(`  records:            ${kept.length} (of ${totalAvailable ?? "unknown"} matching)`);
  console.log(`  parsed criteria:    ${withCriteria}`);
  console.log(`  any site contact:   ${withSiteContact}`);
  console.log(`  any site status:    ${withSiteStatus}`);
  console.log(`  retrieved:          ${retrievedAt}`);
}

main().catch((error) => {
  console.error("Ingestion failed:", error);
  process.exit(1);
});
