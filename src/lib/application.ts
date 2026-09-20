import type { ParticipantProfile, Trial } from "./types";

/**
 * Application forms, and how the passport fills them in.
 *
 * Every research site asks roughly the same opening questions, and people retype
 * the same answers for each one. The passport already holds most of them, so a
 * form is filled from it, and the person confirms every field before anything is
 * sent.
 *
 * Three rules keep autofill honest:
 *  1. A field is filled only from something the person entered themselves.
 *     Nothing is inferred, and a fact marked unknown stays visibly unknown
 *     instead of being left to look like an oversight.
 *  2. Blank fields are not sent. Leaving one empty is a real answer.
 *  3. Contact details are filled in but held back until the person ticks them,
 *     because an application is the first moment they are needed.
 */

export type FieldKind = "text" | "number" | "choice" | "longtext";
export type Origin = "passport" | "marked_unknown" | "not_in_passport";

export interface FormField {
  id: string;
  label: string;
  kind: FieldKind;
  help?: string;
  options?: string[];
  /** Where in the passport this comes from. Absent for questions only the person can answer. */
  source?: string;
  section: "About you" | "Your health" | "Getting to visits" | "For this site" | "Contact";
}

export interface ResolvedField extends FormField {
  value: string;
  origin: Origin;
}

const COMMON: FormField[] = [
  { id: "name", label: "Full name", kind: "text", source: "displayName", section: "About you" },
  { id: "age", label: "Age", kind: "number", source: "ageYears", section: "About you" },
  { id: "location", label: "City and state", kind: "text", source: "location", section: "About you" },
  { id: "condition", label: "Diagnosis", kind: "text", source: "condition", section: "Your health" },
  { id: "stage", label: "Cancer stage", kind: "text", source: "fact:stage", section: "Your health" },
  { id: "hormone_receptor", label: "Hormone receptor status", kind: "text", source: "fact:hormone_receptor", section: "Your health" },
  { id: "her2", label: "HER2 status", kind: "text", source: "fact:her2", section: "Your health" },
  { id: "ecog", label: "Performance status (ECOG), if you were told one", kind: "text", source: "fact:ecog", section: "Your health" },
  { id: "treatment", label: "Treatment so far", kind: "longtext", source: "fact:prior_therapy", section: "Your health" },
  { id: "travel_minutes", label: "Travel time to the site, each way (minutes)", kind: "number", source: "oneWayTravelMinutes", section: "Getting to visits" },
  { id: "travel_help", label: "Would you need help with travel?", kind: "choice", options: ["Yes", "No"], source: "needsTravelHelp", section: "Getting to visits" },
  { id: "companion", label: "Can someone come with you to visits?", kind: "choice", options: ["Yes", "No"], source: "caregiverAvailable", section: "Getting to visits" },
  { id: "work", label: "Work or other commitments we should plan around", kind: "longtext", source: "workConstraints", section: "Getting to visits" },
];

const CONTACT: FormField[] = [
  { id: "email", label: "Email", kind: "text", source: "contact.email", section: "Contact" },
  { id: "phone", label: "Phone", kind: "text", source: "contact.phone", section: "Contact" },
];

export interface ApplicationForm { title: string; notice: string | null; fields: FormField[] }

export function formFor(trial: Trial, fixtureForm?: { title: string; notice?: string; siteFields?: Omit<FormField, "section">[] } | null): ApplicationForm {
  const site = (trial.isFictional ? fixtureForm?.siteFields ?? [] : []).map((field) => ({ ...field, section: "For this site" as const }));
  return {
    title: trial.isFictional && fixtureForm ? fixtureForm.title : "First-contact form",
    notice: trial.isFictional ? fixtureForm?.notice ?? null : "This study has not published its own form, so this is a general one covering what sites usually ask first.",
    fields: [...COMMON, ...site, ...CONTACT],
  };
}

function lookup(profile: ParticipantProfile, source: string): { value: string | null; unknown: boolean } {
  if (source.startsWith("fact:")) {
    const fact = profile.clinicalFacts.find((f) => f.key === source.slice(5));
    if (!fact) return { value: null, unknown: false };
    return fact.provenance === "unknown" || !fact.value ? { value: null, unknown: true } : { value: fact.value, unknown: false };
  }
  const raw: unknown = {
    displayName: profile.displayName.replace(/\s*\(synthetic\)$/, ""),
    ageYears: profile.ageYears,
    location: [profile.city, profile.state].filter(Boolean).join(", ") || null,
    condition: profile.condition,
    oneWayTravelMinutes: profile.oneWayTravelMinutes,
    needsTravelHelp: profile.needsTravelHelp ? "Yes" : "No",
    caregiverAvailable: profile.caregiverAvailable ? "Yes" : "No",
    workConstraints: profile.workConstraints,
    "contact.email": profile.contact.email,
    "contact.phone": profile.contact.phone,
  }[source];
  return { value: raw == null || raw === "" ? null : String(raw), unknown: false };
}

export function autofill(profile: ParticipantProfile, form: ApplicationForm): ResolvedField[] {
  return form.fields.map((field) => {
    if (!field.source) return { ...field, value: "", origin: "not_in_passport" };
    const found = lookup(profile, field.source);
    return { ...field, value: found.value ?? "", origin: found.value ? "passport" : found.unknown ? "marked_unknown" : "not_in_passport" };
  });
}
