import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * SQLite is the relational store and, by default, the search backend too.
 * FTS5 gives lexical retrieval with no external service, so the whole demo runs
 * offline and reproducibly. `src/lib/search.ts` layers an adapter on top so an
 * Elasticsearch deployment can replace the retrieval half without touching
 * anything else.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.MOZAIC_DB ?? path.join(DATA_DIR, "mozaic.db");

let instance: Database.Database | null = null;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY,
  is_fictional INTEGER NOT NULL DEFAULT 0,
  brief_title TEXT,
  official_title TEXT,
  acronym TEXT,
  lead_sponsor TEXT,
  sponsor_class TEXT,
  overall_status TEXT,
  study_first_post_date TEXT,
  last_update_post_date TEXT,
  start_date TEXT,
  completion_date TEXT,
  brief_summary TEXT,
  detailed_description TEXT,
  conditions TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  study_type TEXT,
  phases TEXT NOT NULL DEFAULT '[]',
  enrollment_count INTEGER,
  allocation TEXT,
  masking TEXT,
  interventions TEXT NOT NULL DEFAULT '[]',
  primary_outcomes TEXT NOT NULL DEFAULT '[]',
  eligibility_text TEXT NOT NULL DEFAULT '',
  min_age_years REAL,
  max_age_years REAL,
  min_age_raw TEXT,
  max_age_raw TEXT,
  sex TEXT,
  healthy_volunteers TEXT,
  source_url TEXT,
  retrieved_at TEXT,
  record_hash TEXT,
  visit_schedule TEXT,
  known_logistics TEXT
);

CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
  facility TEXT, city TEXT, state TEXT, country TEXT, zip TEXT,
  site_status TEXT, lat REAL, lon REAL,
  has_contact INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sites_trial ON sites(trial_id);

CREATE TABLE IF NOT EXISTS criteria (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  logic TEXT NOT NULL,
  text TEXT NOT NULL,
  source_start INTEGER NOT NULL,
  source_end INTEGER NOT NULL,
  order_index INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_criteria_trial ON criteria(trial_id);

-- Lexical retrieval. Contentless-external tables keep one copy of the text.
CREATE VIRTUAL TABLE IF NOT EXISTS trials_fts USING fts5(
  id UNINDEXED, title, summary, conditions, interventions, sponsor,
  tokenize = 'porter unicode61'
);
CREATE VIRTUAL TABLE IF NOT EXISTS criteria_fts USING fts5(
  criterion_id UNINDEXED, trial_id UNINDEXED, text,
  tokenize = 'porter unicode61'
);

-- Participant-facing tables. Profiles never enter the search index.
CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  summary TEXT,
  is_demo_persona INTEGER NOT NULL DEFAULT 0,
  age_years REAL, sex TEXT,
  city TEXT, state TEXT, country TEXT, postal_code TEXT, lat REAL, lon REAL,
  condition TEXT, condition_detail TEXT,
  max_travel_minutes INTEGER,
  can_travel_overnight INTEGER NOT NULL DEFAULT 0,
  needs_travel_help INTEGER NOT NULL DEFAULT 0,
  caregiver_available INTEGER NOT NULL DEFAULT 0,
  work_constraints TEXT,
  one_way_travel_minutes INTEGER,
  clinical_facts TEXT NOT NULL DEFAULT '[]',
  contact TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS saved_trials (
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (participant_id, trial_id)
);

CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  recipient_label TEXT NOT NULL,
  trial_id TEXT NOT NULL,
  allowed_fields TEXT NOT NULL,
  purpose TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  -- Random lookup key for an in-person handoff code. Never derived from the
  -- participant, so it discloses nothing on its own.
  handoff_token TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  grant_id TEXT,
  state TEXT NOT NULL,
  message TEXT NOT NULL,
  shared_fields TEXT NOT NULL DEFAULT '{}',
  coordinator_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  inquiry_id TEXT,
  text TEXT NOT NULL,
  category TEXT NOT NULL,
  state TEXT NOT NULL,
  assigned_to TEXT,
  answer TEXT,
  answer_citation TEXT,
  answered_by TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  trial_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  status TEXT NOT NULL,
  visits TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

-- Practical to-dos for a study the person agreed to join. Created from what the
-- study's own material leaves unstated, never from a guess about the protocol.
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Requirements the person marked as matching after reading the study, so the
-- match count can move without rewriting passport facts.
CREATE TABLE IF NOT EXISTS criterion_checks (
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  trial_id TEXT NOT NULL,
  criterion_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (participant_id, trial_id, criterion_id)
);
CREATE INDEX IF NOT EXISTS idx_criterion_checks_participant ON criterion_checks(participant_id);

-- When the participant last opened an inquiry, so the inbox can show what is new
-- to them without changing the inquiry's own state.
CREATE TABLE IF NOT EXISTS inquiry_reads (
  inquiry_id TEXT PRIMARY KEY,
  seen_at TEXT NOT NULL
);

-- A sentence in the person's own words. Shared only with "personal information".
CREATE TABLE IF NOT EXISTS participant_notes (
  participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  note TEXT NOT NULL
);

-- A coordinator's unsent answer. Kept out of the questions table on purpose:
-- nothing that reads a question can show a draft to the participant by mistake.
CREATE TABLE IF NOT EXISTS question_drafts (
  question_id TEXT PRIMARY KEY,
  draft TEXT NOT NULL,
  citation TEXT,
  updated_at TEXT NOT NULL
);

-- A site's reusable answers to questions that recur across participants. A reply
-- is only ever offered as a starting draft; a person still edits and sends it.
CREATE TABLE IF NOT EXISTS saved_replies (
  id TEXT PRIMARY KEY,
  trial_id TEXT NOT NULL,
  keywords TEXT NOT NULL,
  answer TEXT NOT NULL,
  citation TEXT,
  created_at TEXT NOT NULL
);

-- Peer connections. Opting in is explicit, lists exactly which kinds of
-- information may be compared, and can be withdrawn.
CREATE TABLE IF NOT EXISTS peer_optins (
  participant_id TEXT PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  offers TEXT NOT NULL,
  about TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS peer_connections (
  id TEXT PRIMARY KEY,
  trial_id TEXT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  state TEXT NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS peer_messages (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES peer_connections(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  text TEXT NOT NULL,
  reminder INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Generated text, keyed by a hash of the model, prompt version and full prompt.
-- Holds no participant identifiers; survives a demo reset on purpose.
CREATE TABLE IF NOT EXISTS ai_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  subject TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

function openDatabase(): Database.Database {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  // A host may put the database on its own disk (MOZAIC_DB), away from the seed data.
  if (!existsSync(path.dirname(DB_PATH))) mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Database.Database {
  if (!instance) {
    instance = openDatabase();
    seedIfEmpty(instance);
  }
  instance.exec(`
    CREATE TABLE IF NOT EXISTS criterion_checks (
      participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
      trial_id TEXT NOT NULL,
      criterion_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (participant_id, trial_id, criterion_id)
    );
    CREATE INDEX IF NOT EXISTS idx_criterion_checks_participant ON criterion_checks(participant_id);
  `);
  return instance;
}

/** Snapshot manifest, surfaced in the UI so every page can state its data age. */
export function getManifest(): Record<string, unknown> | null {
  const file = path.join(DATA_DIR, "snapshot", "manifest.json");
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

/** The fictional study fixture, read from disk so it stays the single source of
 *  truth for the demo's invented schedule and saved coordinator replies. */
export function getFictionalFixture(): FictionalFixture | null {
  return readJson<FictionalFixture>("fixtures/fictional-study.json");
}

/** The parts of the fixture the app reads back at runtime. */
export interface FictionalFixture {
  studyId: string;
  cannedAnswers: { matches: string[]; answer: string; citation: string }[];
  applicationForm?: { title: string; notice?: string; siteFields?: { id: string; label: string; kind: "text" | "number" | "choice" | "longtext"; help?: string; options?: string[] }[] };
}

function readJson<T>(relativePath: string): T | null {
  const file = path.join(DATA_DIR, relativePath);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One writer for every study, whether it came from the registry snapshot, the
 * fixture, or a research team posting it in the app. Sharing it means a posted
 * study gets the same criteria splitting and the same search index as the rest.
 */
function makeTrialLoader(db: Database.Database) {
  const insertTrial = db.prepare(`
    INSERT OR REPLACE INTO trials (
      id, is_fictional, brief_title, official_title, acronym, lead_sponsor, sponsor_class,
      overall_status, study_first_post_date, last_update_post_date, start_date, completion_date,
      brief_summary, detailed_description, conditions, keywords, study_type, phases,
      enrollment_count, allocation, masking, interventions, primary_outcomes,
      eligibility_text, min_age_years, max_age_years, min_age_raw, max_age_raw, sex,
      healthy_volunteers, source_url, retrieved_at, record_hash, visit_schedule, known_logistics
    ) VALUES (
      @id, @is_fictional, @brief_title, @official_title, @acronym, @lead_sponsor, @sponsor_class,
      @overall_status, @study_first_post_date, @last_update_post_date, @start_date, @completion_date,
      @brief_summary, @detailed_description, @conditions, @keywords, @study_type, @phases,
      @enrollment_count, @allocation, @masking, @interventions, @primary_outcomes,
      @eligibility_text, @min_age_years, @max_age_years, @min_age_raw, @max_age_raw, @sex,
      @healthy_volunteers, @source_url, @retrieved_at, @record_hash, @visit_schedule, @known_logistics
    )`);
  const insertSite = db.prepare(`
    INSERT OR REPLACE INTO sites (id, trial_id, facility, city, state, country, zip, site_status, lat, lon, has_contact)
    VALUES (@id, @trial_id, @facility, @city, @state, @country, @zip, @site_status, @lat, @lon, @has_contact)`);
  const insertCriterion = db.prepare(`
    INSERT OR REPLACE INTO criteria (id, trial_id, role, logic, text, source_start, source_end, order_index)
    VALUES (@id, @trial_id, @role, @logic, @text, @source_start, @source_end, @order_index)`);
  const insertTrialFts = db.prepare(
    "INSERT INTO trials_fts (id, title, summary, conditions, interventions, sponsor) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertCriterionFts = db.prepare(
    "INSERT INTO criteria_fts (criterion_id, trial_id, text) VALUES (?, ?, ?)"
  );

  const loadTrial = (raw: any, isFictional: boolean) => {
    const id = raw.nctId ?? raw.studyId;
    insertTrial.run({
      id,
      is_fictional: isFictional ? 1 : 0,
      brief_title: raw.briefTitle ?? null,
      official_title: raw.officialTitle ?? null,
      acronym: raw.acronym ?? null,
      lead_sponsor: raw.leadSponsor ?? null,
      sponsor_class: raw.sponsorClass ?? null,
      overall_status: raw.overallStatus ?? null,
      study_first_post_date: raw.studyFirstPostDate ?? null,
      last_update_post_date: raw.lastUpdatePostDate ?? null,
      start_date: raw.startDate ?? null,
      completion_date: raw.completionDate ?? null,
      brief_summary: raw.briefSummary ?? null,
      detailed_description: raw.detailedDescription ?? null,
      conditions: JSON.stringify(raw.conditions ?? []),
      keywords: JSON.stringify(raw.keywords ?? []),
      study_type: raw.studyType ?? null,
      phases: JSON.stringify(raw.phases ?? []),
      enrollment_count: raw.enrollmentCount ?? null,
      allocation: raw.allocation ?? null,
      masking: raw.masking ?? null,
      interventions: JSON.stringify(raw.interventions ?? []),
      primary_outcomes: JSON.stringify(raw.primaryOutcomes ?? []),
      eligibility_text: raw.eligibilityText ?? "",
      min_age_years: raw.minAgeYears ?? null,
      max_age_years: raw.maxAgeYears ?? null,
      min_age_raw: raw.minAgeRaw ?? null,
      max_age_raw: raw.maxAgeRaw ?? null,
      sex: raw.sex ?? null,
      // The registry returns this as a boolean; the column is text so the UI can
      // render "not stated" distinctly from "no".
      healthy_volunteers:
        raw.healthyVolunteers == null
          ? null
          : typeof raw.healthyVolunteers === "boolean"
            ? (raw.healthyVolunteers ? "yes" : "no")
            : String(raw.healthyVolunteers),
      source_url: raw.sourceUrl ?? null,
      retrieved_at: raw.retrievedAt ?? null,
      record_hash: raw.recordHash ?? null,
      visit_schedule: raw.visitSchedule ? JSON.stringify(raw.visitSchedule) : null,
      known_logistics: raw.knownLogistics ? JSON.stringify(raw.knownLogistics) : null,
    });

    for (const site of raw.locations ?? raw.sites ?? []) {
      insertSite.run({
        id: site.id,
        trial_id: id,
        facility: site.facility ?? null,
        city: site.city ?? null,
        state: site.state ?? null,
        country: site.country ?? null,
        zip: site.zip ?? null,
        site_status: site.siteStatus ?? null,
        lat: site.lat ?? null,
        lon: site.lon ?? null,
        has_contact: site.hasContact ? 1 : 0,
      });
    }

    const criteria = raw.criteria ?? splitFixtureCriteria(raw.eligibilityText ?? "");
    criteria.forEach((criterion: any, index: number) => {
      const criterionId = `${id}-c${index}`;
      insertCriterion.run({
        id: criterionId,
        trial_id: id,
        role: criterion.role,
        logic: criterion.logic,
        text: criterion.text,
        source_start: criterion.sourceStart,
        source_end: criterion.sourceEnd,
        order_index: index,
      });
      insertCriterionFts.run(criterionId, id, criterion.text);
    });

    insertTrialFts.run(
      id,
      [raw.briefTitle, raw.officialTitle, raw.acronym].filter(Boolean).join(" "),
      [raw.briefSummary, raw.detailedDescription].filter(Boolean).join(" "),
      [...(raw.conditions ?? []), ...(raw.keywords ?? [])].join(" "),
      (raw.interventions ?? []).map((i: any) => `${i.type ?? ""} ${i.name ?? ""}`).join(" "),
      raw.leadSponsor ?? ""
    );
  };

  return loadTrial;
}

/**
 * Saves a study a research team posted, replacing any earlier version of it.
 * The old criteria, sites and index rows go first so an edit cannot leave
 * stale requirements behind for the eligibility engine to read.
 */
export function saveSiteStudy(raw: Record<string, unknown> & { studyId: string }) {
  const db = getDb();
  db.transaction(() => {
    removeStudyRows(db, raw.studyId);
    makeTrialLoader(db)(raw, true);
  })();
}

export function deleteSiteStudy(id: string) {
  const db = getDb();
  db.transaction(() => {
    removeStudyRows(db, id);
    db.prepare("DELETE FROM trials WHERE id = ? AND is_fictional = 1").run(id);
  })();
}

function removeStudyRows(db: Database.Database, id: string) {
  db.prepare("DELETE FROM criteria_fts WHERE trial_id = ?").run(id);
  db.prepare("DELETE FROM trials_fts WHERE id = ?").run(id);
  db.prepare("DELETE FROM criteria WHERE trial_id = ?").run(id);
  db.prepare("DELETE FROM sites WHERE trial_id = ?").run(id);
}

/** Idempotent load of the snapshot and fixtures. Safe to call on every boot. */
export function seedIfEmpty(db: Database.Database, force = false) {
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get() as
    | { value: string }
    | undefined;
  if (seeded && !force) return;

  const snapshot = readJson<any[]>("snapshot/trials.json") ?? [];
  const fixture = readJson<any>("fixtures/fictional-study.json");
  const personaFile = readJson<any>("fixtures/personas.json");

  const loadTrial = makeTrialLoader(db);

  const insertParticipant = db.prepare(`
    INSERT OR REPLACE INTO participants (
      id, display_name, summary, is_demo_persona, age_years, sex, city, state, country,
      postal_code, lat, lon, condition, condition_detail, max_travel_minutes,
      can_travel_overnight, needs_travel_help, caregiver_available, work_constraints,
      one_way_travel_minutes, clinical_facts, contact
    ) VALUES (
      @id, @display_name, @summary, @is_demo_persona, @age_years, @sex, @city, @state, @country,
      @postal_code, @lat, @lon, @condition, @condition_detail, @max_travel_minutes,
      @can_travel_overnight, @needs_travel_help, @caregiver_available, @work_constraints,
      @one_way_travel_minutes, @clinical_facts, @contact
    )`);

  db.transaction(() => {
    db.exec("DELETE FROM trials_fts; DELETE FROM criteria_fts;");
    for (const trial of snapshot) loadTrial(trial, false);
    if (fixture) loadTrial(fixture, true);

    for (const persona of personaFile?.personas ?? []) {
      insertParticipant.run({
        id: persona.id,
        display_name: persona.displayName,
        summary: persona.summary ?? null,
        is_demo_persona: persona.isDemoPersona ? 1 : 0,
        age_years: persona.ageYears ?? null,
        sex: persona.sex ?? null,
        city: persona.city ?? null,
        state: persona.state ?? null,
        country: persona.country ?? null,
        postal_code: persona.postalCode ?? null,
        lat: persona.lat ?? null,
        lon: persona.lon ?? null,
        condition: persona.condition ?? null,
        condition_detail: persona.conditionDetail ?? null,
        max_travel_minutes: persona.maxTravelMinutes ?? null,
        can_travel_overnight: persona.canTravelOvernight ? 1 : 0,
        needs_travel_help: persona.needsTravelHelp ? 1 : 0,
        caregiver_available: persona.caregiverAvailable ? 1 : 0,
        work_constraints: persona.workConstraints ?? null,
        one_way_travel_minutes: persona.oneWayTravelMinutes ?? null,
        clinical_facts: JSON.stringify(persona.clinicalFacts ?? []),
        contact: JSON.stringify(persona.contact ?? {}),
      });
      if (persona.peer) {
        db.prepare("INSERT OR REPLACE INTO peer_optins (participant_id, alias, offers, about, created_at) VALUES (?,?,?,?,?)")
          .run(persona.id, persona.peer.alias, JSON.stringify(persona.peer.offers), persona.peer.about ?? null, new Date().toISOString());
      }
      if (persona.personalNote) {
        db.prepare("INSERT OR REPLACE INTO participant_notes (participant_id, note) VALUES (?, ?)")
          .run(persona.id, persona.personalNote);
      }
    }

    // The fixture's site-policy answers become the site's starting reply library.
    const insertReply = db.prepare("INSERT OR REPLACE INTO saved_replies (id, trial_id, keywords, answer, citation, created_at) VALUES (?,?,?,?,?,?)");
    (fixture?.cannedAnswers ?? []).forEach((reply: any, index: number) => {
      insertReply.run(`seed-${index}`, fixture.studyId, JSON.stringify(reply.matches ?? []), reply.answer, reply.citation ?? null, new Date().toISOString());
    });

    // Past studies Maria has already been to, so the passport has stamps to open.
    const insertEnrollment = db.prepare(
      "INSERT OR REPLACE INTO enrollments (id, participant_id, trial_id, status, visits, created_at) VALUES (?,?,?,?,?,?)"
    );
    for (const past of [
      { id: "enroll-maria-ashby", trialId: "NCT06185205", at: "2023-04-12T12:00:00.000Z" },
      { id: "enroll-maria-heat", trialId: "NCT06222957", at: "2024-09-03T12:00:00.000Z" },
    ]) {
      const exists = db.prepare("SELECT id FROM trials WHERE id = ?").get(past.trialId);
      if (!exists) continue;
      insertEnrollment.run(past.id, "p-maria", past.trialId, "completed", "[]", past.at);
    }

    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_at', ?)").run(
      new Date().toISOString()
    );
  })();
}

/** The fixture stores eligibility as prose; reuse the ingestion's split shape. */
function splitFixtureCriteria(text: string) {
  const out: any[] = [];
  let role = "unspecified";
  let cursor = 0;
  for (const rawLine of text.split("\n")) {
    const lineStart = cursor;
    cursor += rawLine.length + 1;
    const line = rawLine.trim();
    if (!line) continue;
    const heading = line.replace(/[:*\-\s]/g, "").toLowerCase();
    if (heading.startsWith("inclusioncriteria")) { role = "inclusion"; continue; }
    if (heading.startsWith("exclusioncriteria")) { role = "exclusion"; continue; }
    const marker = line.match(/^(?:[-*•]|\d+[.)])\s+/);
    const offset = marker ? marker[0].length : 0;
    const body = line.slice(offset);
    if (body.length < 4) continue;
    const indent = rawLine.length - rawLine.trimStart().length;
    const start = lineStart + indent + offset;
    out.push({
      role,
      text: body,
      sourceStart: start,
      sourceEnd: start + body.length,
      logic: /\bor\b/i.test(body) && !/\band\b/i.test(body) ? "any_of" : "all_of",
    });
  }
  return out;
}

export function resetDemoData() {
  const db = getDb();
  db.transaction(() => {
    db.exec(`
      DELETE FROM inquiries; DELETE FROM questions; DELETE FROM grants;
      DELETE FROM milestones; DELETE FROM enrollments; DELETE FROM saved_trials;
      DELETE FROM todos; DELETE FROM inquiry_reads; DELETE FROM question_drafts; DELETE FROM saved_replies;
      DELETE FROM peer_messages; DELETE FROM peer_connections; DELETE FROM peer_optins;
      DELETE FROM audit_events; DELETE FROM participants;
      DELETE FROM trials WHERE id LIKE 'MZ-%';
    `);
    db.prepare("DELETE FROM meta WHERE key = 'seeded_at'").run();
  })();
  seedIfEmpty(db, true);
}
