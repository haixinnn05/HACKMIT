/**
 * Mozaic domain types.
 *
 * Two rules shape everything here:
 *  1. Clinical suitability, practical feasibility and personal preference stay
 *     in separate fields. They are never collapsed into one score.
 *  2. Unknown is a first-class value. A missing fact is never silently treated
 *     as a satisfied one, and never inferred from context.
 */

/** Where a piece of information came from. Rendered as a visible badge. */
export type Provenance =
  | "registry" // parsed from a ClinicalTrials.gov record
  | "site_confirmed" // confirmed by study staff for a specific site
  | "site_confirmed_fictional" // confirmed by *simulated* staff in the demo fixture
  | "participant_entered" // the person told us
  | "unknown"; // we do not know, and say so

export type CriterionRole = "inclusion" | "exclusion" | "unspecified";

/** Criteria that list alternatives with "or" are disjunctions: failing one
 *  branch does not establish a conflict. */
export type CriterionLogic = "all_of" | "any_of";

export interface Criterion {
  id: string;
  trialId: string;
  role: CriterionRole;
  logic: CriterionLogic;
  text: string;
  /** Character offsets into the trial's original eligibility text. The server
   *  validates that every rendered citation resolves to this exact span. */
  sourceStart: number;
  sourceEnd: number;
  orderIndex: number;
}

export interface Site {
  id: string;
  trialId: string;
  facility: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip: string | null;
  /** Site-level recruiting status. Frequently absent in the registry; absence is
   *  reported as unknown and never inherited from the study-level status. */
  siteStatus: string | null;
  lat: number | null;
  lon: number | null;
  hasContact: boolean;
}

export interface Trial {
  id: string; // NCT id for real records, TP-FIX-* for fixtures
  isFictional: boolean;
  briefTitle: string | null;
  officialTitle: string | null;
  acronym: string | null;
  leadSponsor: string | null;
  sponsorClass: string | null;
  overallStatus: string | null;
  studyFirstPostDate: string | null;
  lastUpdatePostDate: string | null;
  startDate: string | null;
  completionDate: string | null;
  briefSummary: string | null;
  detailedDescription: string | null;
  conditions: string[];
  keywords: string[];
  studyType: string | null;
  phases: string[];
  enrollmentCount: number | null;
  allocation: string | null;
  masking: string | null;
  interventions: { type: string | null; name: string | null }[];
  primaryOutcomes: { measure: string | null; timeFrame: string | null }[];
  eligibilityText: string;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  minAgeRaw: string | null;
  maxAgeRaw: string | null;
  sex: string | null;
  healthyVolunteers: string | null;
  sourceUrl: string | null;
  retrievedAt: string | null;
  recordHash: string | null;
  sites: Site[];
  criteria: Criterion[];
  /** Only ever populated for the fictional fixture. Real registry records do not
   *  publish visit schedules, and the product refuses to invent one. */
  visitSchedule: VisitSchedule | null;
  knownLogistics: KnownLogistics | null;
}

export interface VisitSchedule {
  provenance: Provenance;
  confirmedOn: string | null;
  notes: string | null;
  visits: { name: string; weekOffset: number; onSiteHours: number; procedures: string[] }[];
  remoteContacts: { name: string; weekOffset: number; minutes: number }[];
}

export interface KnownLogistics {
  travelReimbursementStated: boolean;
  parkingReimbursementStated: boolean;
  compensationStated: boolean;
  compensationText: string | null;
  caregiverAccommodationStated: boolean;
  remoteVisitOptionStated: boolean;
}

/** A single clinical fact the participant told us, or explicitly did not know. */
export interface ClinicalFact {
  key: string;
  label: string;
  value: string | null;
  provenance: "self_reported" | "unknown";
  note?: string | null;
}

export interface ParticipantProfile {
  id: string;
  displayName: string;
  summary: string | null;
  isDemoPersona: boolean;
  ageYears: number | null;
  sex: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  lat: number | null;
  lon: number | null;
  condition: string | null;
  conditionDetail: string | null;
  maxTravelMinutes: number | null;
  canTravelOvernight: boolean;
  needsTravelHelp: boolean;
  caregiverAvailable: boolean;
  workConstraints: string | null;
  /** Participant-entered one-way travel time to a site. Absent means the burden
   *  preview reports an incomplete estimate rather than guessing. */
  oneWayTravelMinutes: number | null;
  clinicalFacts: ClinicalFact[];
  /** Kept out of every search input and out of the search index. Only released
   *  through an explicit sharing grant. */
  contact: { email: string | null; phone: string | null };
}

/**
 * The verdict for one criterion. `supported` means a participant-stated fact
 * positively satisfies it. A fact we do not have can only ever produce
 * `unknown` — never `supported`.
 */
export type AssessmentStatus =
  | "supported"
  | "conflict"
  | "unknown"
  | "needs_clinical_review";

export interface CriterionAssessment {
  criterionId: string;
  role: CriterionRole;
  logic: CriterionLogic;
  criterionText: string;
  sourceStart: number;
  sourceEnd: number;
  status: AssessmentStatus;
  /** Plain-language reason. Always references the participant fact used, or says
   *  which fact is missing. */
  rationale: string;
  /** Keys of the participant facts this verdict relied on. Empty for unknown. */
  usedFactKeys: string[];
  /** The exact quoted span from the source eligibility text. */
  evidenceSpan: string;
  reviewState: "auto" | "staff_reviewed";
}

export interface TrialAssessment {
  trialId: string;
  /** Provisional, always. There is no "eligible" state in this product. */
  overall: "possible_option" | "likely_conflict" | "needs_more_information";
  supported: number;
  conflicts: number;
  unknowns: number;
  needsReview: number;
  assessments: CriterionAssessment[];
  /** Human-readable list of the facts that would resolve the most unknowns. */
  missingInformation: { key: string; label: string; affectedCriteria: number }[];
  practicalFit: PracticalFit;
  generatedAt: string;
}

/** Practical feasibility, kept strictly separate from clinical suitability. */
export interface PracticalFit {
  nearestSite: Site | null;
  nearestSiteKm: number | null;
  withinStatedTravelPreference: boolean | null; // null = unknown
  siteRecruitingStatusKnown: boolean;
  siteContactAvailable: boolean;
  notes: string[];
}

export type InquiryState =
  | "draft"
  | "shared"
  | "acknowledged"
  | "needs_information"
  | "answered"
  | "approved"
  | "closed";

export type QuestionState =
  | "open"
  | "assigned"
  | "draft_answer"
  | "reviewed_answer"
  | "resolved";

export type GrantState = "pending" | "active" | "revoked" | "expired";

export interface SharingGrant {
  id: string;
  participantId: string;
  recipientLabel: string;
  trialId: string;
  /** Exactly which profile fields the recipient may read. Nothing else is sent. */
  allowedFields: string[];
  purpose: string;
  state: GrantState;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Present only for in-person handoff codes. */
  handoffToken?: string | null;
}

export interface Question {
  id: string;
  participantId: string;
  trialId: string;
  inquiryId: string | null;
  text: string;
  category: "logistics" | "clinical" | "financial" | "general";
  state: QuestionState;
  assignedTo: string | null;
  answer: string | null;
  answerCitation: string | null;
  answeredBy: string | null;
  answeredAt: string | null;
  createdAt: string;
}

export interface Inquiry {
  id: string;
  participantId: string;
  trialId: string;
  grantId: string | null;
  state: InquiryState;
  message: string;
  sharedFields: Record<string, unknown>;
  coordinatorNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  participantId: string;
  kind: string;
  label: string;
  trialId: string | null;
  createdAt: string;
}

export interface EnrollmentEntry {
  id: string;
  participantId: string;
  trialId: string;
  status: "considering" | "participating" | "declined" | "completed";
  visits: { name: string; date: string; onSiteHours: number; location: string | null }[];
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: string;
  subject: string;
  detail: string | null;
  createdAt: string;
}
