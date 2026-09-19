import type {
  AssessmentStatus, ClinicalFact, Criterion, CriterionAssessment,
  ParticipantProfile, PracticalFit, Site, Trial, TrialAssessment,
} from "./types";

/**
 * Deterministic criterion assessment.
 *
 * This is intentionally a rule engine, not a language model. Every verdict is
 * reproducible, inspectable, and defensible to a coordinator. The model layer
 * (`ai.ts`) can only *explain* what this file decided — it cannot change a
 * status, invent a fact, or upgrade an unknown.
 *
 * The invariants, which `scripts/evaluate.mjs` tests directly:
 *
 *   I1. A fact we do not have can never produce `supported`. Absence of
 *       information is `unknown`, always.
 *   I2. An exclusion criterion that applies is a `conflict`, never a match.
 *   I3. A criterion joined by "or" (`any_of`) cannot produce a `conflict` from a
 *       single failing branch; the other branch may still be satisfiable.
 *   I4. Nothing is inferred from context — not sex, not a missing biomarker, not
 *       organ function, not prior treatment.
 *   I5. No trial ever reaches an "eligible" state. The best available verdict is
 *       "possible option to discuss".
 */

/* ------------------------------------------------------------------ helpers */

const normalize = (text: string) => text.toLowerCase().replace(/[‐-―]/g, "-");

/**
 * Detect a negation that flips what the criterion requires. Deliberately
 * conservative: value words like "HER2-negative" are handled by their own
 * matcher and must not be read as sentence negation here.
 */
function hasNegation(text: string, feature: RegExp): boolean {
  const normalized = normalize(text);
  const match = feature.exec(normalized);
  if (!match) return false;
  const before = normalized.slice(Math.max(0, match.index - 60), match.index);
  return /\b(no|not|without|absence of|free of|must not|cannot|excluding|other than|non-)\s*(evidence of\s+|history of\s+|known\s+|active\s+|documented\s+)?$/.test(
    before.trimEnd() + " "
  ) || /\b(no|without|absence of|free of|must not|never had|excluding)\b[^.;]{0,40}$/.test(before);
}

/**
 * What satisfying this criterion requires of the participant.
 * Role and negation combine: an inclusion criterion with a negation demands the
 * same thing as a plain exclusion criterion.
 */
type Requirement = "must_have" | "must_not_have";

function requirementFor(role: Criterion["role"], negated: boolean): Requirement {
  const baseIsMustHave = role !== "exclusion";
  const flipped = negated ? !baseIsMustHave : baseIsMustHave;
  return flipped ? "must_have" : "must_not_have";
}

interface Verdict {
  status: AssessmentStatus;
  rationale: string;
  usedFactKeys: string[];
}

/** A yes/no participant feature (e.g. metastatic disease, pregnancy). */
function evaluateBoolean(opts: {
  requirement: Requirement;
  logic: Criterion["logic"];
  factValue: string | null;
  factLabel: string;
  factKey: string;
  featureName: string;
}): Verdict {
  const { requirement, logic, factValue, factLabel, factKey, featureName } = opts;

  // I1 — no fact, no positive verdict.
  if (factValue == null) {
    return {
      status: "unknown",
      rationale: `This depends on ${featureName}, which is not recorded in your passport. Adding "${factLabel}" would resolve it, or a coordinator can confirm it.`,
      usedFactKeys: [],
    };
  }

  const participantHas = /^(yes|true|positive|present)$/i.test(factValue.trim());
  const satisfies = requirement === "must_have" ? participantHas : !participantHas;

  if (satisfies) {
    return {
      status: "supported",
      rationale: `You recorded ${factLabel.toLowerCase()}: ${factValue}. That matches what this criterion asks for.`,
      usedFactKeys: [factKey],
    };
  }

  // I3 — one failing branch of a disjunction is not a conflict.
  if (logic === "any_of") {
    return {
      status: "needs_clinical_review",
      rationale: `You recorded ${factLabel.toLowerCase()}: ${factValue}. This criterion lists alternatives, so one part not matching does not rule you out. Study staff should confirm.`,
      usedFactKeys: [factKey],
    };
  }

  return {
    status: "conflict",
    rationale: `You recorded ${factLabel.toLowerCase()}: ${factValue}. This criterion requires ${requirement === "must_have" ? featureName : `no ${featureName}`}, so it looks like a conflict to raise with study staff.`,
    usedFactKeys: [factKey],
  };
}

/** A participant feature with a named value (e.g. HER2 positive / negative). */
function evaluateValued(opts: {
  requiredValue: string;
  logic: Criterion["logic"];
  factValue: string | null;
  factLabel: string;
  factKey: string;
  featureName: string;
}): Verdict {
  const { requiredValue, logic, factValue, factLabel, factKey, featureName } = opts;

  if (factValue == null) {
    return {
      status: "unknown",
      rationale: `This criterion asks for ${featureName} ${requiredValue}. Your ${factLabel.toLowerCase()} is not recorded, so this cannot be checked. This is a good question for the study team.`,
      usedFactKeys: [],
    };
  }

  if (normalize(factValue).includes(normalize(requiredValue))) {
    return {
      status: "supported",
      rationale: `You recorded ${factLabel.toLowerCase()}: ${factValue}, which matches the ${requiredValue} requirement.`,
      usedFactKeys: [factKey],
    };
  }

  if (logic === "any_of") {
    return {
      status: "needs_clinical_review",
      rationale: `Your ${factLabel.toLowerCase()} is ${factValue}, while this criterion mentions ${requiredValue}. Because the criterion lists alternatives, staff review is needed rather than a conclusion.`,
      usedFactKeys: [factKey],
    };
  }

  return {
    status: "conflict",
    rationale: `Your ${factLabel.toLowerCase()} is ${factValue}, but this criterion asks for ${requiredValue}. Raise this with study staff before assuming either way.`,
    usedFactKeys: [factKey],
  };
}

/* ----------------------------------------------------------------- matchers */

interface Matcher {
  key: string;
  label: string;
  /** Returns a verdict when this matcher recognises the criterion, else null. */
  run(criterion: Criterion, facts: Map<string, ClinicalFact>, profile: ParticipantProfile): Verdict | null;
}

const fact = (facts: Map<string, ClinicalFact>, key: string) => {
  const found = facts.get(key);
  // A fact explicitly marked unknown is treated exactly like a missing one.
  if (!found || found.provenance === "unknown" || found.value == null) return null;
  return found;
};

const METASTATIC = /\b(metastatic|metastas[ei]s|stage\s*iv\b|stage\s*4\b|distant metastas)/;
const PREGNANCY = /\b(pregnan|breast-?feeding|lactating|nursing mother)/;
const BRAIN_METS = /\b(brain metastas|cns metastas|leptomeningeal|cerebral metastas)/;
const ECOG = /\becog\b|\bperformance status\b|\bkarnofsky\b/;
const HER2 = /\bher-?2\b|\bhuman epidermal growth factor receptor 2\b/;
const HORMONE_RECEPTOR = /\b(hormone receptor|hr[-\s]?(positive|negative)|estrogen receptor|\ber\b\s*[+-]|progesterone receptor)/;
const PRIOR_LINES = /\b(prior|previous|preceding)\b[^.;]{0,40}\b(line|regimen|therap|treatment)/;
const LAB_OR_ORGAN = /\b(adequate (organ|bone marrow|hepatic|renal|cardiac)|absolute neutrophil|platelet count|hemoglobin|creatinine|bilirubin|\balt\b|\bast\b|lvef|ejection fraction|qtc)\b/;
const CONSENT_ADMIN = /\b(informed consent|willing (and )?able to|able to comply|sign(ed)? the|protocol requirements|willing to provide)\b/;

const MATCHERS: Matcher[] = [
  // Ordering matters: the first matcher that recognises a criterion decides it.
  // Lab and organ-function checks come first deliberately. A criterion such as
  // "adequate organ function and no evidence of metastatic disease" depends on
  // test results Trial Passport does not hold, so it must route to staff review
  // even though a later matcher could produce a confident-looking verdict on the
  // half it does recognise.
  {
    key: "labs",
    label: "Laboratory and organ function",
    run(criterion) {
      if (!LAB_OR_ORGAN.test(normalize(criterion.text))) return null;
      // I4 — organ function is never inferred. It requires test results.
      return {
        status: "needs_clinical_review",
        rationale:
          "This criterion depends on laboratory or organ-function test results. Trial Passport does not hold test results and will not estimate them. Screening tests answer this.",
        usedFactKeys: [],
      };
    },
  },
  {
    key: "metastatic",
    label: "Metastatic disease",
    run(criterion, facts) {
      const text = normalize(criterion.text);
      if (!METASTATIC.test(text)) return null;
      if (BRAIN_METS.test(text)) return null; // handled by its own matcher
      const record = fact(facts, "metastatic") ?? fact(facts, "stage");
      const value = record
        ? record.key === "stage"
          ? /\biv\b|\b4\b/i.test(record.value!) ? "yes" : "no"
          : record.value
        : null;
      return evaluateBoolean({
        requirement: requirementFor(criterion.role, hasNegation(criterion.text, METASTATIC)),
        logic: criterion.logic,
        factValue: value,
        factLabel: record?.label ?? "Metastatic disease",
        factKey: record?.key ?? "metastatic",
        featureName: "metastatic (stage IV) disease",
      });
    },
  },
  {
    key: "pregnant",
    label: "Pregnancy or breastfeeding",
    run(criterion, facts) {
      if (!PREGNANCY.test(normalize(criterion.text))) return null;
      const record = fact(facts, "pregnant");
      return evaluateBoolean({
        requirement: requirementFor(criterion.role, hasNegation(criterion.text, PREGNANCY)),
        logic: criterion.logic,
        factValue: record?.value ?? null,
        factLabel: record?.label ?? "Pregnant or breastfeeding",
        factKey: "pregnant",
        featureName: "pregnancy or breastfeeding",
      });
    },
  },
  {
    key: "brain_mets",
    label: "Brain metastases",
    run(criterion, facts) {
      if (!BRAIN_METS.test(normalize(criterion.text))) return null;
      const record = fact(facts, "brain_mets");
      return evaluateBoolean({
        requirement: requirementFor(criterion.role, hasNegation(criterion.text, BRAIN_METS)),
        logic: criterion.logic,
        factValue: record?.value ?? null,
        factLabel: record?.label ?? "Brain metastases",
        factKey: "brain_mets",
        featureName: "brain or central nervous system metastases",
      });
    },
  },
  {
    key: "her2",
    label: "HER2 status",
    run(criterion, facts) {
      const text = normalize(criterion.text);
      if (!HER2.test(text)) return null;
      // Read the required value from the criterion itself rather than guessing.
      const requiredValue = /her-?2[-\s]*(positive|\+)/.test(text)
        ? "positive"
        : /her-?2[-\s]*(negative|-\b|low)/.test(text)
          ? "negative"
          : null;
      if (!requiredValue) return null;
      const record = fact(facts, "her2");
      return evaluateValued({
        requiredValue,
        logic: criterion.logic,
        factValue: record?.value ?? null,
        factLabel: record?.label ?? "HER2 status",
        factKey: "her2",
        featureName: "HER2",
      });
    },
  },
  {
    key: "hormone_receptor",
    label: "Hormone receptor status",
    run(criterion, facts) {
      const text = normalize(criterion.text);
      if (!HORMONE_RECEPTOR.test(text)) return null;
      const requiredValue = /(hormone receptor|hr|estrogen receptor|er)[-\s]*(positive|\+)/.test(text)
        ? "positive"
        : /(hormone receptor|hr|estrogen receptor|er)[-\s]*(negative|-)/.test(text)
          ? "negative"
          : null;
      if (!requiredValue) return null;
      const record = fact(facts, "hormone_receptor");
      return evaluateValued({
        requiredValue,
        logic: criterion.logic,
        factValue: record?.value ?? null,
        factLabel: record?.label ?? "Hormone receptor status",
        factKey: "hormone_receptor",
        featureName: "hormone receptor status",
      });
    },
  },
  {
    key: "ecog",
    label: "Performance status",
    run(criterion, facts) {
      const text = normalize(criterion.text);
      if (!ECOG.test(text)) return null;
      const record = fact(facts, "ecog");
      if (!record) {
        return {
          status: "unknown",
          rationale:
            "This criterion uses a performance status score (ECOG), which is assigned by a clinician. Your passport does not record one, so this cannot be checked here.",
          usedFactKeys: [],
        };
      }
      // Accept "0 or 1", "0-1", "0, 1 or 2", "<= 2".
      const allowed = new Set<number>();
      for (const m of text.matchAll(/(\d)\s*(?:-|to|or|,)\s*(\d)/g)) {
        const [lo, hi] = [Number(m[1]), Number(m[2])].sort((a, b) => a - b);
        for (let n = lo; n <= hi; n += 1) allowed.add(n);
      }
      const atMost = text.match(/(?:<=|≤|less than or equal to|no (?:greater|higher|worse) than)\s*(\d)/);
      if (atMost) for (let n = 0; n <= Number(atMost[1]); n += 1) allowed.add(n);
      if (allowed.size === 0) {
        for (const m of text.matchAll(/\b(?:ecog|performance status|ps)\b[^.;]{0,20}?(\d)/g)) {
          allowed.add(Number(m[1]));
        }
      }
      if (allowed.size === 0) {
        return {
          status: "needs_clinical_review",
          rationale: `Your recorded performance status is ${record.value}, but the exact score this study allows could not be read reliably from the criterion text. Staff should confirm against the original wording.`,
          usedFactKeys: ["ecog"],
        };
      }
      const value = Number(record.value);
      if (!Number.isFinite(value)) return null;
      if (allowed.has(value)) {
        return {
          status: "supported",
          rationale: `You recorded an ECOG performance status of ${value}, which is within the range this criterion allows (${[...allowed].sort().join(", ")}).`,
          usedFactKeys: ["ecog"],
        };
      }
      if (criterion.logic === "any_of" || criterion.role === "exclusion") {
        return {
          status: "needs_clinical_review",
          rationale: `Your recorded ECOG status is ${value}; the criterion refers to ${[...allowed].sort().join(", ")}. Performance status is reassessed at screening, so this needs staff confirmation rather than a conclusion.`,
          usedFactKeys: ["ecog"],
        };
      }
      return {
        status: "conflict",
        rationale: `Your recorded ECOG performance status is ${value}, outside the ${[...allowed].sort().join(", ")} this criterion allows. Performance status is reassessed at screening, so confirm with staff.`,
        usedFactKeys: ["ecog"],
      };
    },
  },
  {
    key: "prior_lines",
    label: "Prior therapy",
    run(criterion, facts) {
      const text = normalize(criterion.text);
      if (!PRIOR_LINES.test(text)) return null;
      const record = fact(facts, "prior_lines");
      if (!record) {
        return {
          status: "unknown",
          rationale:
            "This criterion depends on how many prior lines of therapy you have had. That is not recorded in your passport, and prior-treatment history is usually confirmed from your medical records.",
          usedFactKeys: [],
        };
      }
      return {
        status: "needs_clinical_review",
        rationale: `You recorded ${record.value} prior line(s) of therapy. Counting lines of therapy follows study-specific rules, so this must be confirmed by study staff against your records.`,
        usedFactKeys: ["prior_lines"],
      };
    },
  },
  {
    key: "consent_admin",
    label: "Consent and study procedures",
    run(criterion) {
      if (!CONSENT_ADMIN.test(normalize(criterion.text))) return null;
      return {
        status: "unknown",
        rationale:
          "This is about agreeing to the study's consent and procedures. It is decided during the consent conversation with study staff, not in this app.",
        usedFactKeys: [],
      };
    },
  },
];

/* ---------------------------------------------------- trial-level attributes */

/** Age and sex come from structured registry fields, not criterion prose. */
function structuralAssessments(trial: Trial, profile: ParticipantProfile): CriterionAssessment[] {
  const out: CriterionAssessment[] = [];

  if (trial.minAgeYears != null || trial.maxAgeYears != null) {
    // Prefer the registry's own wording ("18 Years"); fall back to the parsed
    // number so a fixture without raw strings still reads correctly.
    const describe = (raw: string | null, years: number | null) =>
      raw ?? (years != null ? `${years} years` : null);
    const minText = describe(trial.minAgeRaw, trial.minAgeYears);
    const maxText = describe(trial.maxAgeRaw, trial.maxAgeYears);
    const bounds = [
      minText ? `minimum ${minText}` : null,
      maxText ? `maximum ${maxText}` : null,
    ].filter(Boolean).join(", ");

    let status: AssessmentStatus = "supported";
    let rationale = `You are ${profile.ageYears}. The registry record lists ${bounds}.`;

    if (profile.ageYears == null) {
      status = "unknown";
      rationale = `The registry record lists ${bounds}. Your age is not recorded, so this cannot be checked.`;
    } else if (trial.minAgeYears != null && profile.ageYears < trial.minAgeYears) {
      status = "conflict";
      rationale = `You are ${profile.ageYears}. The registry record lists a ${bounds}, so you are below the stated minimum.`;
    } else if (trial.maxAgeYears != null && profile.ageYears > trial.maxAgeYears) {
      status = "conflict";
      rationale = `You are ${profile.ageYears}. The registry record lists a ${bounds}, so you are above the stated maximum.`;
    }

    out.push({
      criterionId: `${trial.id}-structural-age`,
      role: "inclusion", logic: "all_of",
      criterionText: `Age: ${bounds}`,
      sourceStart: -1, sourceEnd: -1,
      status, rationale,
      usedFactKeys: profile.ageYears == null ? [] : ["age"],
      evidenceSpan: `Registry eligibility fields, ${bounds}`,
      reviewState: "auto",
    });
  }

  if (trial.sex && trial.sex !== "ALL") {
    const matches = profile.sex === trial.sex;
    out.push({
      criterionId: `${trial.id}-structural-sex`,
      role: "inclusion", logic: "all_of",
      criterionText: `Enrolling: ${trial.sex.toLowerCase()}`,
      sourceStart: -1, sourceEnd: -1,
      status: profile.sex == null ? "unknown" : matches ? "supported" : "conflict",
      rationale: profile.sex == null
        ? `The registry record lists this study as enrolling ${trial.sex.toLowerCase()} participants. Your passport does not record this.`
        : matches
          ? `The registry record lists this study as enrolling ${trial.sex.toLowerCase()} participants.`
          : `The registry record lists this study as enrolling ${trial.sex.toLowerCase()} participants. Some studies list a restriction that a site can clarify; it is worth asking rather than assuming.`,
      usedFactKeys: profile.sex == null ? [] : ["sex"],
      evidenceSpan: `Registry eligibility field, sex: ${trial.sex}`,
      reviewState: "auto",
    });
  }

  return out;
}

/* ------------------------------------------------------------- practical fit */

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)));
}

/**
 * Practical feasibility. Straight-line distance is an approximation and the UI
 * labels it as one — it is not a drive time, and it never becomes an eligibility
 * signal.
 */
export function assessPracticalFit(trial: Trial, profile: ParticipantProfile): PracticalFit {
  const notes: string[] = [];
  let nearestSite: Site | null = null;
  let nearestSiteKm: number | null = null;

  if (profile.lat != null && profile.lon != null) {
    for (const site of trial.sites) {
      if (site.lat == null || site.lon == null) continue;
      const km = haversineKm(
        { lat: profile.lat, lon: profile.lon },
        { lat: site.lat, lon: site.lon }
      );
      if (nearestSiteKm == null || km < nearestSiteKm) {
        nearestSiteKm = km;
        nearestSite = site;
      }
    }
  }

  if (trial.sites.length === 0) {
    notes.push("The registry record lists no study locations, so distance cannot be estimated.");
  } else if (nearestSiteKm == null) {
    notes.push("Listed locations have no coordinates in the registry record, so distance is unknown.");
  }

  const withoutCoordinates = trial.sites.filter((site) => site.lat == null).length;
  if (withoutCoordinates > 0 && nearestSiteKm != null) {
    notes.push(`${withoutCoordinates} of ${trial.sites.length} listed sites have no coordinates and were not considered.`);
  }

  const siteRecruitingStatusKnown = trial.sites.some((site) => site.siteStatus);
  if (!siteRecruitingStatusKnown && trial.sites.length > 0) {
    notes.push("Site-level recruiting status is not published. A study marked recruiting overall may not be open at this location.");
  }

  const siteContactAvailable = trial.sites.some((site) => site.hasContact);
  if (!siteContactAvailable) {
    notes.push("No site contact is listed in the registry record, which makes this study harder to ask about.");
  }

  // Compare distance against the stated preference only when both are known.
  let withinStatedTravelPreference: boolean | null = null;
  if (nearestSiteKm != null && profile.maxTravelMinutes != null) {
    // A deliberately crude 60 km/h assumption, stated in the UI.
    const approxMinutes = Math.round((nearestSiteKm / 60) * 60);
    withinStatedTravelPreference = approxMinutes <= profile.maxTravelMinutes;
    notes.push(
      `Nearest listed site is about ${nearestSiteKm} km away in a straight line (roughly ${approxMinutes} minutes at 60 km/h, not a real drive time). You said you can travel up to ${profile.maxTravelMinutes} minutes.`
    );
  }

  if (profile.needsTravelHelp) {
    notes.push("You said you need help with travel. Whether this study offers any is not stated in the registry record, ask the coordinator.");
  }

  return {
    nearestSite, nearestSiteKm, withinStatedTravelPreference,
    siteRecruitingStatusKnown, siteContactAvailable, notes,
  };
}

/* ---------------------------------------------------------------- entrypoint */

export function assessTrial(trial: Trial, profile: ParticipantProfile): TrialAssessment {
  const facts = new Map(profile.clinicalFacts.map((f) => [f.key, f]));
  const assessments: CriterionAssessment[] = [...structuralAssessments(trial, profile)];

  for (const criterion of trial.criteria) {
    let verdict: Verdict | null = null;
    for (const matcher of MATCHERS) {
      verdict = matcher.run(criterion, facts, profile);
      if (verdict) break;
    }

    if (!verdict) {
      // Nothing recognised the criterion. That is an unknown we show honestly,
      // not a criterion we quietly drop.
      verdict = {
        status: "unknown",
        rationale:
          "Trial Passport could not check this criterion automatically. The original wording is shown above so you and the study team can read it together.",
        usedFactKeys: [],
      };
    }

    assessments.push({
      criterionId: criterion.id,
      role: criterion.role,
      logic: criterion.logic,
      criterionText: criterion.text,
      sourceStart: criterion.sourceStart,
      sourceEnd: criterion.sourceEnd,
      status: verdict.status,
      rationale: verdict.rationale,
      usedFactKeys: verdict.usedFactKeys,
      // The span is re-read from the source text, so a citation cannot drift
      // from what it claims to quote.
      evidenceSpan: trial.eligibilityText.slice(criterion.sourceStart, criterion.sourceEnd),
      reviewState: "auto",
    });
  }

  const count = (status: AssessmentStatus) =>
    assessments.filter((a) => a.status === status).length;
  const supported = count("supported");
  const conflicts = count("conflict");
  const unknowns = count("unknown");
  const needsReview = count("needs_clinical_review");

  // I5 — the ceiling is "possible option to discuss".
  const overall: TrialAssessment["overall"] =
    conflicts > 0 ? "likely_conflict"
    : unknowns > supported ? "needs_more_information"
    : "possible_option";

  // Rank missing facts by how many criteria each would unlock.
  const missingByKey = new Map<string, { key: string; label: string; affectedCriteria: number }>();
  for (const assessment of assessments) {
    if (assessment.status !== "unknown") continue;
    for (const [key, label] of inferMissingKeys(assessment.criterionText)) {
      const entry = missingByKey.get(key) ?? { key, label, affectedCriteria: 0 };
      entry.affectedCriteria += 1;
      missingByKey.set(key, entry);
    }
  }

  return {
    trialId: trial.id,
    overall, supported, conflicts, unknowns, needsReview,
    assessments,
    missingInformation: [...missingByKey.values()].sort(
      (a, b) => b.affectedCriteria - a.affectedCriteria
    ),
    practicalFit: assessPracticalFit(trial, profile),
    generatedAt: new Date().toISOString(),
  };
}

/** Which passport field, if added, would let us check this criterion. */
function inferMissingKeys(text: string): [string, string][] {
  const normalized = normalize(text);
  const out: [string, string][] = [];
  if (HER2.test(normalized)) out.push(["her2", "HER2 status"]);
  if (HORMONE_RECEPTOR.test(normalized)) out.push(["hormone_receptor", "Hormone receptor status"]);
  if (ECOG.test(normalized)) out.push(["ecog", "Performance status (ECOG)"]);
  if (METASTATIC.test(normalized)) out.push(["metastatic", "Metastatic disease"]);
  if (BRAIN_METS.test(normalized)) out.push(["brain_mets", "Brain metastases"]);
  if (PRIOR_LINES.test(normalized)) out.push(["prior_lines", "Prior lines of therapy"]);
  return out;
}
