import type { ParticipantProfile } from "./types";

/**
 * In-person visit packets. A scanned passport fills only what that grant
 * allowed. Staff confirm every field, then a signature closes the packet.
 */

export type VisitFieldKind = "text" | "number" | "choice" | "longtext" | "signature";
export type VisitOrigin = "passport" | "marked_unknown" | "not_in_passport";
export type VisitPackId = "consent" | "screening" | "onstudy";

export interface VisitField {
  id: string;
  label: string;
  kind: VisitFieldKind;
  help?: string;
  options?: string[];
  source?: string;
  section: string;
  required?: boolean;
}

export interface ResolvedVisitField extends VisitField {
  value: string;
  origin: VisitOrigin;
}

export interface VisitPack {
  id: VisitPackId;
  title: string;
  sub: string;
  fields: VisitField[];
}

const CONSENT: VisitField[] = [
  { id: "name", label: "Full name", kind: "text", source: "displayName", section: "Person", required: true },
  { id: "age", label: "Age", kind: "number", source: "ageYears", section: "Person" },
  { id: "location", label: "City and state", kind: "text", source: "location", section: "Person" },
  { id: "consent_date", label: "Consent date", kind: "text", section: "Consent", required: true },
  { id: "hipaa", label: "HIPAA authorization", kind: "choice", options: ["Signed", "Not signed"], section: "Consent", required: true },
  { id: "future_samples", label: "Store samples or data for future research", kind: "choice", options: ["Yes", "No", "Declined to answer"], section: "Consent" },
  { id: "other_studies", label: "May be contacted about other studies", kind: "choice", options: ["Yes", "No"], section: "Consent" },
  { id: "emergency_name", label: "Emergency contact name", kind: "text", section: "Emergency" },
  { id: "emergency_phone", label: "Emergency contact phone", kind: "text", section: "Emergency" },
  { id: "witness", label: "Witness or staff name", kind: "text", section: "Signatures" },
  { id: "signature", label: "Patient signature", kind: "signature", section: "Signatures", required: true },
];

const SCREENING: VisitField[] = [
  { id: "name", label: "Full name", kind: "text", source: "displayName", section: "Person", required: true },
  { id: "age", label: "Age", kind: "number", source: "ageYears", section: "Person" },
  { id: "sex", label: "Sex", kind: "text", source: "sex", section: "Person" },
  { id: "location", label: "City and state", kind: "text", source: "location", section: "Person" },
  { id: "condition", label: "Diagnosis", kind: "text", source: "condition", section: "History" },
  { id: "condition_detail", label: "History detail", kind: "longtext", source: "conditionDetail", section: "History" },
  { id: "stage", label: "Cancer stage", kind: "text", source: "fact:stage", section: "History" },
  { id: "hormone_receptor", label: "Hormone receptor status", kind: "text", source: "fact:hormone_receptor", section: "History" },
  { id: "her2", label: "HER2 status", kind: "text", source: "fact:her2", section: "History" },
  { id: "prior_therapy", label: "Treatment so far", kind: "longtext", source: "fact:prior_therapy", section: "History" },
  { id: "allergies", label: "Allergies", kind: "longtext", section: "History" },
  { id: "medications", label: "Medications and supplements", kind: "longtext", section: "History" },
  { id: "family_history", label: "Family medical history", kind: "longtext", section: "History" },
  { id: "smoking", label: "Smoking", kind: "choice", options: ["Never", "Former", "Current"], section: "Lifestyle" },
  { id: "alcohol", label: "Alcohol", kind: "choice", options: ["None", "Occasional", "Regular"], section: "Lifestyle" },
  { id: "activity", label: "Activity", kind: "text", section: "Lifestyle" },
  { id: "recent_tests", label: "Recent labs, biomarkers, or imaging", kind: "longtext", section: "Records" },
  { id: "insurance", label: "Insurance", kind: "text", section: "Records" },
  { id: "ecog", label: "Performance status (ECOG)", kind: "text", source: "fact:ecog", section: "Assessment" },
  { id: "ecog_staff", label: "Staff performance assessment", kind: "choice", options: ["0", "1", "2", "3", "4"], help: "Completed by staff at this visit.", section: "Assessment" },
  { id: "notes", label: "Staff notes", kind: "longtext", section: "Assessment" },
  { id: "signature", label: "Patient signature", kind: "signature", section: "Signatures", required: true },
];

const ONSTUDY: VisitField[] = [
  { id: "name", label: "Full name", kind: "text", source: "displayName", section: "Person" },
  { id: "symptoms", label: "Symptoms or side effects", kind: "longtext", section: "Today" },
  { id: "qol", label: "How are you feeling overall?", kind: "choice", options: ["Excellent", "Good", "Fair", "Poor"], section: "Today", required: true },
  { id: "dose_log", label: "Medication or dosing since last visit", kind: "longtext", section: "Today" },
  { id: "med_updates", label: "Changes to medications", kind: "longtext", section: "Today" },
  { id: "adverse_events", label: "New problems since last visit", kind: "longtext", section: "Today" },
  { id: "signature", label: "Patient signature", kind: "signature", section: "Signatures", required: true },
];

export const VISIT_PACKS: VisitPack[] = [
  { id: "consent", title: "Informed consent", sub: "Consent, HIPAA, optional permissions, emergency contact.", fields: CONSENT },
  { id: "screening", title: "Screening visit", sub: "History, medications, lifestyle, records, performance status.", fields: SCREENING },
  { id: "onstudy", title: "This visit", sub: "Symptoms, quality of life, dosing, new problems.", fields: ONSTUDY },
];

export function visitPack(id: string): VisitPack | null {
  return VISIT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function suggestedPack(visitName: string | null): VisitPackId {
  const name = (visitName ?? "").toLowerCase();
  if (name.includes("screen")) return "screening";
  if (name.includes("consent")) return "consent";
  return "onstudy";
}

export function currentStudyVisit<T extends { name: string; date: string }>(visits: T[] | undefined, today: string): T | null {
  if (!visits?.length) return null;
  return visits.find((visit) => visit.date === today) ?? visits.find((visit) => visit.date >= today) ?? null;
}

function answersForPack(packId: VisitPackId, visitName: string | null, saved: SavedVisitAnswers[]): Record<string, string> | null {
  const row = saved.find((item) => {
    if (item.pack !== packId) return false;
    if (packId === "onstudy" && visitName) return item.visitName === visitName;
    return true;
  });
  return row?.answers ?? null;
}

function fieldComplete(field: VisitField, answers: Record<string, string>): boolean {
  const value = (answers[field.id] ?? "").trim();
  if (!field.required) return true;
  if (field.id === "hipaa") return value === "Signed";
  return Boolean(value);
}

export function packAnswersComplete(packId: string, answers: Record<string, string>): boolean {
  const pack = visitPack(packId);
  if (!pack) return false;
  return pack.fields.every((field) => fieldComplete(field, answers));
}

export function requiredPacks(visitName: string | null, saved: SavedVisitAnswers[]): VisitPackId[] {
  const type = suggestedPack(visitName);
  const consentDone = packAnswersComplete("consent", answersForPack("consent", visitName, saved) ?? {});
  if (type === "consent") return ["consent"];
  if (type === "screening") return consentDone ? ["screening"] : ["consent", "screening"];
  return consentDone ? ["onstudy"] : ["consent", "onstudy"];
}

export function isPackOnFile(packId: VisitPackId, visitName: string | null, saved: SavedVisitAnswers[]): boolean {
  const answers = answersForPack(packId, visitName, saved);
  return Boolean(answers && packAnswersComplete(packId, answers));
}

export function missingRequiredPacks(visitName: string | null, saved: SavedVisitAnswers[]): VisitPack[] {
  return requiredPacks(visitName, saved)
    .filter((id) => !isPackOnFile(id, visitName, saved))
    .map((id) => visitPack(id))
    .filter((pack): pack is VisitPack => Boolean(pack));
}

export function latestVisitAnswers(packId: string, visitName: string | null, saved: SavedVisitAnswers[]): Record<string, string> {
  return answersForPack(packId as VisitPackId, visitName, saved) ?? {};
}

export interface SavedVisitAnswers {
  pack: string;
  visitName: string | null;
  answers: Record<string, string>;
}

function grantKey(source: string): string {
  if (source.startsWith("fact:")) return source;
  if (source === "displayName" || source === "ageYears" || source === "sex" || source === "location") return "age";
  if (source === "condition" || source === "conditionDetail") return "condition";
  if (source.startsWith("contact.")) return "contact";
  return "practical";
}

function sourceAllowed(source: string, allowed: Set<string>): boolean {
  const key = grantKey(source);
  if (allowed.has(key)) return true;
  if (key.startsWith("fact:") && allowed.has("facts")) return true;
  return false;
}

function lookup(profile: ParticipantProfile, source: string): { value: string | null; unknown: boolean } {
  if (source.startsWith("fact:")) {
    const fact = profile.clinicalFacts.find((item) => item.key === source.slice(5));
    if (!fact) return { value: null, unknown: false };
    return fact.provenance === "unknown" || !fact.value ? { value: null, unknown: true } : { value: fact.value, unknown: false };
  }
  const raw: unknown = {
    displayName: profile.displayName.replace(/\s*\(synthetic\)$/, ""),
    ageYears: profile.ageYears,
    sex: profile.sex ? profile.sex[0] + profile.sex.slice(1).toLowerCase() : null,
    location: [profile.city, profile.state].filter(Boolean).join(", ") || null,
    condition: profile.condition,
    conditionDetail: profile.conditionDetail,
    oneWayTravelMinutes: profile.oneWayTravelMinutes,
    needsTravelHelp: profile.needsTravelHelp ? "Yes" : "No",
    caregiverAvailable: profile.caregiverAvailable ? "Yes" : "No",
    workConstraints: profile.workConstraints,
    "contact.email": profile.contact.email,
    "contact.phone": profile.contact.phone,
  }[source];
  return { value: raw == null || raw === "" ? null : String(raw), unknown: false };
}

export function fillVisitPack(profile: ParticipantProfile, pack: VisitPack, allowed: string[]): ResolvedVisitField[] {
  const grant = new Set(allowed);
  return pack.fields.map((field) => {
    if (!field.source) {
      const today = field.id === "consent_date" ? new Date().toISOString().slice(0, 10) : "";
      return { ...field, value: today, origin: "not_in_passport" };
    }
    if (!sourceAllowed(field.source, grant)) return { ...field, value: "", origin: "not_in_passport" };
    const found = lookup(profile, field.source);
    return { ...field, value: found.value ?? "", origin: found.value ? "passport" : found.unknown ? "marked_unknown" : "not_in_passport" };
  });
}
