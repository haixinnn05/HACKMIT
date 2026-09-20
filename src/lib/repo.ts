import { getDb } from "./db";
import type {
  ClinicalFact, Criterion, EnrollmentEntry, Inquiry, InquiryState, Milestone,
  ParticipantProfile, Question, QuestionState, SharingGrant, Site, Trial,
} from "./types";
import { randomUUID } from "node:crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */

const json = <T,>(value: unknown, fallback: T): T => {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

function rowToTrial(row: any, sites: Site[], criteria: Criterion[]): Trial {
  return {
    id: row.id,
    isFictional: Boolean(row.is_fictional),
    briefTitle: row.brief_title,
    officialTitle: row.official_title,
    acronym: row.acronym,
    leadSponsor: row.lead_sponsor,
    sponsorClass: row.sponsor_class,
    overallStatus: row.overall_status,
    studyFirstPostDate: row.study_first_post_date,
    lastUpdatePostDate: row.last_update_post_date,
    startDate: row.start_date,
    completionDate: row.completion_date,
    briefSummary: row.brief_summary,
    detailedDescription: row.detailed_description,
    conditions: json(row.conditions, [] as string[]),
    keywords: json(row.keywords, [] as string[]),
    studyType: row.study_type,
    phases: json(row.phases, [] as string[]),
    enrollmentCount: row.enrollment_count,
    allocation: row.allocation,
    masking: row.masking,
    interventions: json(row.interventions, [] as Trial["interventions"]),
    primaryOutcomes: json(row.primary_outcomes, [] as Trial["primaryOutcomes"]),
    eligibilityText: row.eligibility_text ?? "",
    minAgeYears: row.min_age_years,
    maxAgeYears: row.max_age_years,
    minAgeRaw: row.min_age_raw,
    maxAgeRaw: row.max_age_raw,
    sex: row.sex,
    healthyVolunteers: row.healthy_volunteers,
    sourceUrl: row.source_url,
    retrievedAt: row.retrieved_at,
    recordHash: row.record_hash,
    sites,
    criteria,
    visitSchedule: json(row.visit_schedule, null as Trial["visitSchedule"]),
    knownLogistics: json(row.known_logistics, null as Trial["knownLogistics"]),
  };
}

const rowToSite = (row: any): Site => ({
  id: row.id, trialId: row.trial_id, facility: row.facility, city: row.city,
  state: row.state, country: row.country, zip: row.zip, siteStatus: row.site_status,
  lat: row.lat, lon: row.lon, hasContact: Boolean(row.has_contact),
});

const rowToCriterion = (row: any): Criterion => ({
  id: row.id, trialId: row.trial_id, role: row.role, logic: row.logic, text: row.text,
  sourceStart: row.source_start, sourceEnd: row.source_end, orderIndex: row.order_index,
});

export function getTrial(id: string): Trial | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM trials WHERE id = ?").get(id);
  if (!row) return null;
  const sites = db.prepare("SELECT * FROM sites WHERE trial_id = ?").all(id).map(rowToSite);
  const criteria = db
    .prepare("SELECT * FROM criteria WHERE trial_id = ? ORDER BY order_index")
    .all(id)
    .map(rowToCriterion);
  return rowToTrial(row, sites, criteria);
}

export function getTrials(ids: string[]): Trial[] {
  if (ids.length === 0) return [];
  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM trials WHERE id IN (${placeholders})`).all(...ids) as any[];
  const sites = db.prepare(`SELECT * FROM sites WHERE trial_id IN (${placeholders})`).all(...ids) as any[];
  const criteria = db
    .prepare(`SELECT * FROM criteria WHERE trial_id IN (${placeholders}) ORDER BY order_index`)
    .all(...ids) as any[];

  const byTrial = <T,>(items: any[], map: (row: any) => T) =>
    items.reduce<Record<string, T[]>>((acc, row) => {
      (acc[row.trial_id] ??= []).push(map(row));
      return acc;
    }, {});

  const siteMap = byTrial(sites, rowToSite);
  const criterionMap = byTrial(criteria, rowToCriterion);
  const ordered = new Map(rows.map((row) => [row.id, row]));
  return ids
    .map((id) => ordered.get(id))
    .filter(Boolean)
    .map((row) => rowToTrial(row, siteMap[row.id] ?? [], criterionMap[row.id] ?? []));
}

export function rowToParticipant(row: any): ParticipantProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    summary: row.summary,
    isDemoPersona: Boolean(row.is_demo_persona),
    ageYears: row.age_years,
    sex: row.sex,
    city: row.city, state: row.state, country: row.country, postalCode: row.postal_code,
    lat: row.lat, lon: row.lon,
    condition: row.condition,
    conditionDetail: row.condition_detail,
    maxTravelMinutes: row.max_travel_minutes,
    canTravelOvernight: Boolean(row.can_travel_overnight),
    needsTravelHelp: Boolean(row.needs_travel_help),
    caregiverAvailable: Boolean(row.caregiver_available),
    workConstraints: row.work_constraints,
    oneWayTravelMinutes: row.one_way_travel_minutes,
    clinicalFacts: json(row.clinical_facts, [] as ClinicalFact[]),
    contact: json(row.contact, { email: null, phone: null }),
  };
}

export function getParticipant(id: string): ParticipantProfile | null {
  const row = getDb().prepare("SELECT * FROM participants WHERE id = ?").get(id);
  return row ? rowToParticipant(row) : null;
}

export function listParticipants(): ParticipantProfile[] {
  return (getDb().prepare("SELECT * FROM participants ORDER BY is_demo_persona DESC, id").all() as any[])
    .map(rowToParticipant);
}

export function updateParticipant(id: string, patch: Partial<ParticipantProfile>) {
  const current = getParticipant(id);
  if (!current) throw new Error(`Unknown participant ${id}`);
  const next = { ...current, ...patch };
  getDb()
    .prepare(`
      UPDATE participants SET
        display_name=@display_name, age_years=@age_years, sex=@sex, city=@city, state=@state,
        country=@country, postal_code=@postal_code, condition=@condition,
        condition_detail=@condition_detail, max_travel_minutes=@max_travel_minutes,
        can_travel_overnight=@can_travel_overnight, needs_travel_help=@needs_travel_help,
        caregiver_available=@caregiver_available, work_constraints=@work_constraints,
        one_way_travel_minutes=@one_way_travel_minutes, clinical_facts=@clinical_facts,
        contact=@contact
      WHERE id=@id`)
    .run({
      id,
      display_name: next.displayName,
      age_years: next.ageYears,
      sex: next.sex,
      city: next.city, state: next.state, country: next.country, postal_code: next.postalCode,
      condition: next.condition, condition_detail: next.conditionDetail,
      max_travel_minutes: next.maxTravelMinutes,
      can_travel_overnight: next.canTravelOvernight ? 1 : 0,
      needs_travel_help: next.needsTravelHelp ? 1 : 0,
      caregiver_available: next.caregiverAvailable ? 1 : 0,
      work_constraints: next.workConstraints,
      one_way_travel_minutes: next.oneWayTravelMinutes,
      clinical_facts: JSON.stringify(next.clinicalFacts),
      contact: JSON.stringify(next.contact),
    });
  return next;
}

/* ---------------------------------------------------------------- saved trials */

export function saveTrial(participantId: string, trialId: string) {
  getDb()
    .prepare("INSERT OR IGNORE INTO saved_trials (participant_id, trial_id, created_at) VALUES (?, ?, ?)")
    .run(participantId, trialId, new Date().toISOString());
  recordMilestone(participantId, "saved_option", "Saved an option to review", trialId);
}

export function unsaveTrial(participantId: string, trialId: string) {
  getDb().prepare("DELETE FROM saved_trials WHERE participant_id = ? AND trial_id = ?")
    .run(participantId, trialId);
}

export function listSavedTrialIds(participantId: string): string[] {
  return (getDb()
    .prepare("SELECT trial_id FROM saved_trials WHERE participant_id = ? ORDER BY created_at DESC")
    .all(participantId) as any[]).map((row) => row.trial_id);
}

/* ------------------------------------------------------------------ milestones */

/** Milestones record an action the person took. They are private, carry no
 *  points, and are never awarded for enrolling or for staying enrolled. */
export function recordMilestone(
  participantId: string, kind: string, label: string, trialId: string | null = null
): Milestone | null {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM milestones WHERE participant_id = ? AND kind = ? AND IFNULL(trial_id,'') = ?")
    .get(participantId, kind, trialId ?? "");
  if (existing) return null; // a stamp is earned once, not accumulated

  const milestone: Milestone = {
    id: randomUUID(), participantId, kind, label, trialId,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO milestones (id, participant_id, kind, label, trial_id, created_at) VALUES (?,?,?,?,?,?)"
  ).run(milestone.id, participantId, kind, label, trialId, milestone.createdAt);
  return milestone;
}

export function listMilestones(participantId: string): Milestone[] {
  return (getDb()
    .prepare("SELECT * FROM milestones WHERE participant_id = ? ORDER BY created_at DESC")
    .all(participantId) as any[])
    .map((row) => ({
      id: row.id, participantId: row.participant_id, kind: row.kind,
      label: row.label, trialId: row.trial_id, createdAt: row.created_at,
    }));
}

/* ----------------------------------------------------------------- audit trail */

export function audit(actor: string, action: string, subject: string, detail?: string) {
  getDb()
    .prepare("INSERT INTO audit_events (id, actor, action, subject, detail, created_at) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(), actor, action, subject, detail ?? null, new Date().toISOString());
}

export function listAudit(limit = 50) {
  return (getDb()
    .prepare("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?")
    .all(limit) as any[])
    .map((row) => ({
      id: row.id, actor: row.actor, action: row.action, subject: row.subject,
      detail: row.detail, createdAt: row.created_at,
    }));
}

/* --------------------------------------------------------------- sharing grants */

const rowToGrant = (row: any): SharingGrant => ({
  id: row.id, participantId: row.participant_id, recipientLabel: row.recipient_label,
  trialId: row.trial_id, allowedFields: json(row.allowed_fields, [] as string[]),
  purpose: row.purpose, state: row.state, createdAt: row.created_at,
  expiresAt: row.expires_at, revokedAt: row.revoked_at,
  handoffToken: row.handoff_token ?? null,
});

export function createGrant(input: {
  participantId: string; recipientLabel: string; trialId: string;
  allowedFields: string[]; purpose: string; expiresAt?: string | null;
  handoffToken?: string | null;
}): SharingGrant {
  const grant: SharingGrant = {
    id: randomUUID(),
    participantId: input.participantId,
    recipientLabel: input.recipientLabel,
    trialId: input.trialId,
    allowedFields: input.allowedFields,
    purpose: input.purpose,
    state: "active",
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    handoffToken: input.handoffToken ?? null,
  };
  getDb()
    .prepare(`INSERT INTO grants (id, participant_id, recipient_label, trial_id, allowed_fields, purpose, state, created_at, expires_at, revoked_at, handoff_token)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(grant.id, grant.participantId, grant.recipientLabel, grant.trialId,
      JSON.stringify(grant.allowedFields), grant.purpose, grant.state,
      grant.createdAt, grant.expiresAt, null, grant.handoffToken);
  audit(input.participantId, "grant.created",
    `${input.recipientLabel} / ${input.trialId}`, input.allowedFields.join(", "));
  return grant;
}

export function listGrants(participantId: string): SharingGrant[] {
  return (getDb()
    .prepare("SELECT * FROM grants WHERE participant_id = ? ORDER BY created_at DESC")
    .all(participantId) as any[]).map(rowToGrant);
}

/** Look up a handoff grant by its random code. Returns null for an unknown,
 *  revoked or expired token — the page must not distinguish between them. */
export function getGrantByToken(token: string): SharingGrant | null {
  const row = getDb().prepare("SELECT * FROM grants WHERE handoff_token = ?").get(token);
  if (!row) return null;
  const grant = rowToGrant(row);
  return isGrantActive(grant) ? grant : null;
}

export function getGrant(id: string): SharingGrant | null {
  const row = getDb().prepare("SELECT * FROM grants WHERE id = ?").get(id);
  return row ? rowToGrant(row) : null;
}

/** Revocation blocks future reads inside the app. It cannot recall anything a
 *  recipient already exported, and the UI says so. */
export function revokeGrant(id: string) {
  const now = new Date().toISOString();
  getDb().prepare("UPDATE grants SET state='revoked', revoked_at=? WHERE id=?").run(now, id);
  const grant = getGrant(id);
  if (grant) audit(grant.participantId, "grant.revoked", `${grant.recipientLabel} / ${grant.trialId}`);
}

export function isGrantActive(grant: SharingGrant | null): boolean {
  if (!grant) return false;
  if (grant.state !== "active") return false;
  if (grant.expiresAt && new Date(grant.expiresAt) < new Date()) return false;
  return true;
}

/* ---------------------------------------------------------------- inquiries */

const rowToInquiry = (row: any): Inquiry => ({
  id: row.id, participantId: row.participant_id, trialId: row.trial_id,
  grantId: row.grant_id, state: row.state, message: row.message,
  sharedFields: json(row.shared_fields, {} as Record<string, unknown>),
  coordinatorNote: row.coordinator_note,
  createdAt: row.created_at, updatedAt: row.updated_at,
});

export function createInquiry(input: {
  participantId: string; trialId: string; grantId: string;
  message: string; sharedFields: Record<string, unknown>;
}): Inquiry {
  const now = new Date().toISOString();
  const inquiry: Inquiry = {
    id: randomUUID(), participantId: input.participantId, trialId: input.trialId,
    grantId: input.grantId, state: "shared", message: input.message,
    sharedFields: input.sharedFields, coordinatorNote: null,
    createdAt: now, updatedAt: now,
  };
  getDb()
    .prepare(`INSERT INTO inquiries (id, participant_id, trial_id, grant_id, state, message, shared_fields, coordinator_note, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(inquiry.id, inquiry.participantId, inquiry.trialId, inquiry.grantId, inquiry.state,
      inquiry.message, JSON.stringify(inquiry.sharedFields), null, now, now);
  audit(input.participantId, "inquiry.shared", input.trialId);
  recordMilestone(input.participantId, "shared_inquiry", "Shared a reviewed inquiry", input.trialId);
  return inquiry;
}

export function setInquiryState(id: string, state: InquiryState, note?: string | null) {
  const now = new Date().toISOString();
  getDb()
    .prepare("UPDATE inquiries SET state=?, coordinator_note=COALESCE(?, coordinator_note), updated_at=? WHERE id=?")
    .run(state, note ?? null, now, id);
}

export function getInquiry(id: string): Inquiry | null {
  const row = getDb().prepare("SELECT * FROM inquiries WHERE id = ?").get(id);
  return row ? rowToInquiry(row) : null;
}

export function listInquiriesForParticipant(participantId: string): Inquiry[] {
  return (getDb()
    .prepare("SELECT * FROM inquiries WHERE participant_id = ? ORDER BY updated_at DESC")
    .all(participantId) as any[]).map(rowToInquiry);
}

/** Most recent inquiry this person already sent about a given study. */
export function getInquiryForTrial(participantId: string, trialId: string): Inquiry | null {
  const row = getDb()
    .prepare(`SELECT * FROM inquiries WHERE participant_id = ? AND trial_id = ?
              ORDER BY CASE WHEN state = 'closed' THEN 1 ELSE 0 END, updated_at DESC
              LIMIT 1`)
    .get(participantId, trialId);
  return row ? rowToInquiry(row) : null;
}

/** Open inquiry for a study, if there is one. Closed ones do not count: the
 *  person has to send a new application to start again. */
export function getOpenInquiryForTrial(participantId: string, trialId: string): Inquiry | null {
  const row = getDb()
    .prepare(`SELECT * FROM inquiries WHERE participant_id = ? AND trial_id = ? AND state != 'closed'
              ORDER BY updated_at DESC LIMIT 1`)
    .get(participantId, trialId);
  return row ? rowToInquiry(row) : null;
}

/** The coordinator inbox. Only inquiries backed by an active grant are visible;
 *  a revoked grant removes the item rather than merely hiding a field. */
export function listInquiriesForCoordinator(): Inquiry[] {
  const rows = getDb()
    .prepare(`SELECT i.* FROM inquiries i
              JOIN grants g ON g.id = i.grant_id
              WHERE g.state = 'active' AND i.state != 'draft'
              ORDER BY i.updated_at DESC`)
    .all() as any[];
  return rows.map(rowToInquiry).filter((inquiry) => isGrantActive(getGrant(inquiry.grantId!)));
}

/* ----------------------------------------------------------------- questions */

const rowToQuestion = (row: any): Question => ({
  id: row.id, participantId: row.participant_id, trialId: row.trial_id,
  inquiryId: row.inquiry_id, text: row.text, category: row.category, state: row.state,
  assignedTo: row.assigned_to, answer: row.answer, answerCitation: row.answer_citation,
  answeredBy: row.answered_by, answeredAt: row.answered_at, createdAt: row.created_at,
});

export function createQuestion(input: {
  participantId: string; trialId: string; text: string;
  category?: Question["category"]; inquiryId?: string | null;
}): Question {
  const question: Question = {
    id: randomUUID(), participantId: input.participantId, trialId: input.trialId,
    inquiryId: input.inquiryId ?? null, text: input.text,
    category: input.category ?? "general", state: "open", assignedTo: null,
    answer: null, answerCitation: null, answeredBy: null, answeredAt: null,
    createdAt: new Date().toISOString(),
  };
  getDb()
    .prepare(`INSERT INTO questions (id, participant_id, trial_id, inquiry_id, text, category, state, assigned_to, answer, answer_citation, answered_by, answered_at, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(question.id, question.participantId, question.trialId, question.inquiryId,
      question.text, question.category, question.state, null, null, null, null, null,
      question.createdAt);
  recordMilestone(input.participantId, "prepared_questions", "Prepared my questions", input.trialId);
  return question;
}

export function listQuestions(filter: {
  participantId?: string; trialId?: string; inquiryId?: string;
}): Question[] {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.participantId) { clauses.push("participant_id = ?"); params.push(filter.participantId); }
  if (filter.trialId) { clauses.push("trial_id = ?"); params.push(filter.trialId); }
  if (filter.inquiryId) { clauses.push("inquiry_id = ?"); params.push(filter.inquiryId); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return (getDb()
    .prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC`)
    .all(...params) as any[]).map(rowToQuestion);
}

export function getQuestion(id: string): Question | null {
  const row = getDb().prepare("SELECT * FROM questions WHERE id = ?").get(id);
  return row ? rowToQuestion(row) : null;
}

export function updateQuestion(id: string, patch: {
  state?: QuestionState; assignedTo?: string | null;
  answer?: string | null; answerCitation?: string | null; answeredBy?: string | null;
}) {
  const current = getQuestion(id);
  if (!current) throw new Error(`Unknown question ${id}`);
  // Only sending an answer stamps the time. Resolving or reopening must not.
  const answered = patch.state === "reviewed_answer";
  getDb()
    .prepare(`UPDATE questions SET state=?, assigned_to=?, answer=?, answer_citation=?, answered_by=?, answered_at=? WHERE id=?`)
    .run(
      patch.state ?? current.state,
      patch.assignedTo !== undefined ? patch.assignedTo : current.assignedTo,
      patch.answer !== undefined ? patch.answer : current.answer,
      patch.answerCitation !== undefined ? patch.answerCitation : current.answerCitation,
      patch.answeredBy !== undefined ? patch.answeredBy : current.answeredBy,
      answered ? new Date().toISOString() : current.answeredAt,
      id
    );
  if (answered) {
    recordMilestone(current.participantId, "received_response",
      "Received a coordinator response", current.trialId);
  }
  return getQuestion(id)!;
}

/* --------------------------------------------------------------- enrollments */

const rowToEnrollment = (row: any): EnrollmentEntry => ({
  id: row.id, participantId: row.participant_id, trialId: row.trial_id,
  status: row.status, visits: json(row.visits, [] as EnrollmentEntry["visits"]),
  createdAt: row.created_at,
});

export function upsertEnrollment(input: Omit<EnrollmentEntry, "id" | "createdAt">): EnrollmentEntry {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM enrollments WHERE participant_id = ? AND trial_id = ?")
    .get(input.participantId, input.trialId) as any;
  const id = existing?.id ?? randomUUID();
  const createdAt = existing?.created_at ?? new Date().toISOString();
  db.prepare(`INSERT OR REPLACE INTO enrollments (id, participant_id, trial_id, status, visits, created_at)
              VALUES (?,?,?,?,?,?)`)
    .run(id, input.participantId, input.trialId, input.status, JSON.stringify(input.visits), createdAt);
  return { ...input, id, createdAt };
}

export function listEnrollments(participantId: string): EnrollmentEntry[] {
  return (getDb()
    .prepare("SELECT * FROM enrollments WHERE participant_id = ? ORDER BY created_at")
    .all(participantId) as any[]).map(rowToEnrollment);
}

/** The study currently being taken. Only one is allowed at a time. */
export function getParticipatingEnrollment(participantId: string): EnrollmentEntry | null {
  const active = listEnrollments(participantId).filter((entry) => entry.status === "participating");
  return active.at(-1) ?? null;
}

export function clearEnrollment(participantId: string, trialId: string) {
  getDb().prepare("DELETE FROM enrollments WHERE participant_id = ? AND trial_id = ?").run(participantId, trialId);
}

/* --------------------------------------------------------------------- todos */

export interface Todo {
  id: string; participantId: string; trialId: string;
  label: string; kind: string; done: boolean; createdAt: string;
}

const rowToTodo = (row: any): Todo => ({
  id: row.id, participantId: row.participant_id, trialId: row.trial_id,
  label: row.label, kind: row.kind, done: Boolean(row.done), createdAt: row.created_at,
});

export function listTodos(participantId: string): Todo[] {
  return (getDb()
    .prepare("SELECT * FROM todos WHERE participant_id = ? ORDER BY done, created_at")
    .all(participantId) as any[]).map(rowToTodo);
}

/** Idempotent per (participant, trial, kind), so agreeing twice adds nothing. */
export function ensureTodo(participantId: string, trialId: string, kind: string, label: string) {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM todos WHERE participant_id = ? AND trial_id = ? AND kind = ?")
    .get(participantId, trialId, kind);
  if (existing) return;
  db.prepare("INSERT INTO todos (id, participant_id, trial_id, label, kind, done, created_at) VALUES (?,?,?,?,?,0,?)")
    .run(randomUUID(), participantId, trialId, label, kind, new Date().toISOString());
}

export function toggleTodo(id: string, participantId: string) {
  // Scoped by participant: nobody can tick another person's list.
  getDb().prepare("UPDATE todos SET done = 1 - done WHERE id = ? AND participant_id = ?")
    .run(id, participantId);
}

export function clearTodos(participantId: string, trialId: string) {
  getDb().prepare("DELETE FROM todos WHERE participant_id = ? AND trial_id = ?")
    .run(participantId, trialId);
}

/* -------------------------------------------------------- criterion checks */

export function listConfirmedCriterionIds(participantId: string, trialId: string): string[] {
  return (getDb()
    .prepare("SELECT criterion_id FROM criterion_checks WHERE participant_id = ? AND trial_id = ?")
    .all(participantId, trialId) as { criterion_id: string }[])
    .map((row) => row.criterion_id);
}

export function listConfirmedCriterionIdsByTrial(participantId: string): Map<string, string[]> {
  const rows = getDb()
    .prepare("SELECT trial_id, criterion_id FROM criterion_checks WHERE participant_id = ?")
    .all(participantId) as { trial_id: string; criterion_id: string }[];
  const byTrial = new Map<string, string[]>();
  for (const row of rows) {
    const list = byTrial.get(row.trial_id) ?? [];
    list.push(row.criterion_id);
    byTrial.set(row.trial_id, list);
  }
  return byTrial;
}

export function setCriterionCheck(
  participantId: string, trialId: string, criterionId: string, met: boolean,
) {
  const db = getDb();
  if (met) {
    db.prepare(`
      INSERT OR IGNORE INTO criterion_checks (participant_id, trial_id, criterion_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(participantId, trialId, criterionId, new Date().toISOString());
    return;
  }
  db.prepare("DELETE FROM criterion_checks WHERE participant_id = ? AND trial_id = ? AND criterion_id = ?")
    .run(participantId, trialId, criterionId);
}

/* -------------------------------------------------------------- inbox reads */

export function markInquirySeen(inquiryId: string) {
  getDb().prepare("INSERT OR REPLACE INTO inquiry_reads (inquiry_id, seen_at) VALUES (?, ?)")
    .run(inquiryId, new Date().toISOString());
}

/** Unread means the site changed something since the person last opened it. */
export function isInquiryUnread(inquiry: Inquiry): boolean {
  if (inquiry.updatedAt === inquiry.createdAt) return false;
  const row = getDb().prepare("SELECT seen_at FROM inquiry_reads WHERE inquiry_id = ?")
    .get(inquiry.id) as { seen_at: string } | undefined;
  return !row || row.seen_at < inquiry.updatedAt;
}

/* ------------------------------------------------------------ personal note */

export function getPersonalNote(participantId: string): string | null {
  const row = getDb().prepare("SELECT note FROM participant_notes WHERE participant_id = ?")
    .get(participantId) as { note: string } | undefined;
  return row?.note ?? null;
}

export function setPersonalNote(participantId: string, note: string) {
  const db = getDb();
  const trimmed = note.trim().slice(0, 140);
  if (!trimmed) db.prepare("DELETE FROM participant_notes WHERE participant_id = ?").run(participantId);
  else db.prepare("INSERT OR REPLACE INTO participant_notes (participant_id, note) VALUES (?, ?)").run(participantId, trimmed);
}

/* ----------------------------------------------------------- answer drafts */

export function saveQuestionDraft(questionId: string, draft: string, citation: string | null) {
  getDb().prepare("INSERT OR REPLACE INTO question_drafts (question_id, draft, citation, updated_at) VALUES (?,?,?,?)")
    .run(questionId, draft, citation, new Date().toISOString());
}

export function getQuestionDraft(questionId: string): { draft: string; citation: string | null } | null {
  const row = getDb().prepare("SELECT draft, citation FROM question_drafts WHERE question_id = ?")
    .get(questionId) as { draft: string; citation: string | null } | undefined;
  return row ?? null;
}

export function deleteQuestionDraft(questionId: string) {
  getDb().prepare("DELETE FROM question_drafts WHERE question_id = ?").run(questionId);
}

/* ------------------------------------------------------------ saved replies */

export interface SavedReply { id: string; trialId: string; keywords: string[]; answer: string; citation: string | null; createdAt: string }

export function listSavedReplies(trialId?: string): SavedReply[] {
  const rows = (trialId
    ? getDb().prepare("SELECT * FROM saved_replies WHERE trial_id = ? ORDER BY created_at").all(trialId)
    : getDb().prepare("SELECT * FROM saved_replies ORDER BY created_at").all()) as any[];
  return rows.map((row) => ({
    id: row.id, trialId: row.trial_id, keywords: json(row.keywords, [] as string[]),
    answer: row.answer, citation: row.citation, createdAt: row.created_at,
  }));
}

export function addSavedReply(input: { trialId: string; keywords: string[]; answer: string; citation: string | null }) {
  getDb().prepare("INSERT INTO saved_replies (id, trial_id, keywords, answer, citation, created_at) VALUES (?,?,?,?,?,?)")
    .run(randomUUID(), input.trialId, JSON.stringify(input.keywords), input.answer, input.citation, new Date().toISOString());
}

export function deleteSavedReply(id: string) {
  getDb().prepare("DELETE FROM saved_replies WHERE id = ?").run(id);
}

/* ------------------------------------------------------- the site's patients */

/**
 * People the site may currently see: those with at least one active sharing
 * grant attached to an inquiry. This is a list of relationships the participant
 * started, not a directory. There is no way to browse or search people who have
 * not shared something, and revoking a grant removes the person from it.
 */
export function listAuthorizedParticipantIds(): string[] {
  return [...new Set(listInquiriesForCoordinator().map((inquiry) => inquiry.participantId))];
}

/** A short-lived in-person code, looked up by the pass number printed on the ticket. */
export function findHandoffTokenByPassNumber(passNumber: string): string | null {
  const code = passNumber.trim().toLowerCase().replace(/[^0-9a-f]/g, "");
  if (code.length !== 8) return null;
  const rows = getDb().prepare("SELECT * FROM grants WHERE handoff_token LIKE ? AND state = 'active'").all(`${code}%`) as any[];
  const live = rows.map(rowToGrant).filter(isGrantActive);
  // An ambiguous prefix resolves to nothing rather than to a guess.
  return live.length === 1 ? live[0].handoffToken ?? null : null;
}
