import type { ParticipantProfile, Provenance, Trial } from "./types";

/**
 * Participation Preview.
 *
 * Turns a *verified* visit schedule plus participant-entered travel time into
 * what participation would actually cost in hours. The arithmetic is shown to
 * the user in full, because a number nobody can check is not useful to bring to
 * a coordinator.
 *
 * Rules:
 *  - Visit count is never inferred from study duration. No schedule means no
 *    total — the preview reports an incomplete estimate and says what is missing.
 *  - Waiting time and unscheduled procedures are excluded and labelled as
 *    excluded, so the figure reads as a floor rather than a promise.
 *  - Missing travel time produces on-site hours only, clearly marked partial.
 *  - "What if" adjustments are hypothetical until a site confirms them.
 */

export interface BurdenInput {
  /** One-way travel time in minutes. Null means unknown. */
  oneWayTravelMinutes: number | null;
  /** Hypothetical override of the number of on-site visits. */
  visitCountOverride?: number | null;
  /** Hypothetical override of one-way travel minutes. */
  travelOverrideMinutes?: number | null;
}

export interface BurdenLine {
  label: string;
  detail: string;
  hours: number | null;
  provenance: Provenance;
}

export interface BurdenPreview {
  available: boolean;
  /** Why a total could not be produced, when it could not. */
  unavailableReason: string | null;
  scheduleProvenance: Provenance;
  scheduleConfirmedOn: string | null;
  visitCount: number | null;
  onSiteHours: number | null;
  travelHours: number | null;
  remoteHours: number | null;
  totalHours: number | null;
  /** True when some component is unknown, so the total is a floor, not a figure. */
  partial: boolean;
  /** Human-readable arithmetic, e.g. "4 × (2h on site + 2 × 45min travel) = 14h". */
  formula: string | null;
  lines: BurdenLine[];
  exclusions: string[];
  openQuestions: string[];
  /** Set when the preview reflects a hypothetical the person typed in. */
  hypothetical: boolean;
  weeksSpanned: number | null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function formatMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes < 60) return `${minutes}min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export function computeBurden(
  trial: Trial,
  profile: ParticipantProfile,
  input: BurdenInput = { oneWayTravelMinutes: profile.oneWayTravelMinutes }
): BurdenPreview {
  const schedule = trial.visitSchedule;
  const lines: BurdenLine[] = [];
  const openQuestions: string[] = [];

  const exclusions = [
    "Waiting time at the clinic",
    "Procedures added during a visit",
    "Travel delays",
    "Time spent on paperwork or phone calls between visits",
  ];

  if (!schedule || schedule.visits.length === 0) {
    // The honest answer. Registry records almost never publish a visit schedule,
    // and guessing one from trial duration would be an invention.
    return {
      available: false,
      unavailableReason:
        "This study's visit schedule is not published in its registry record. Mozaic will not estimate the number of visits from the study's length, because that would be a guess. Ask the study team how many visits there are and how long each one takes.",
      scheduleProvenance: "unknown",
      scheduleConfirmedOn: null,
      visitCount: null, onSiteHours: null, travelHours: null, remoteHours: null,
      totalHours: null, partial: true, formula: null,
      lines: [
        {
          label: "Number of on-site visits",
          detail: "Not stated in the registry record",
          hours: null,
          provenance: "unknown",
        },
        {
          label: "Length of each visit",
          detail: "Not stated in the registry record",
          hours: null,
          provenance: "unknown",
        },
      ],
      exclusions,
      openQuestions: [
        "How many on-site visits does this study require, and over what period?",
        "How long does a typical visit take, including waiting time?",
        "Are any visits possible remotely or at a location closer to me?",
      ],
      hypothetical: false,
      weeksSpanned: null,
    };
  }

  const hypothetical =
    input.visitCountOverride != null || input.travelOverrideMinutes != null;

  const allVisits = schedule.visits;
  const visitCount = input.visitCountOverride ?? allVisits.length;
  // For a hypothetical reduction, use the average visit length rather than
  // pretending to know which visits a site would drop.
  const averageVisitHours =
    allVisits.reduce((sum, visit) => sum + visit.onSiteHours, 0) / allVisits.length;
  const onSiteHours =
    input.visitCountOverride != null
      ? round1(averageVisitHours * visitCount)
      : round1(allVisits.reduce((sum, visit) => sum + visit.onSiteHours, 0));

  lines.push({
    label: `${visitCount} on-site visit${visitCount === 1 ? "" : "s"}`,
    detail:
      input.visitCountOverride != null
        ? `Hypothetical: ${visitCount} visits at the average scheduled length of ${round1(averageVisitHours)}h`
        : allVisits.map((visit) => `${visit.name} (${visit.onSiteHours}h)`).join(", "),
    hours: onSiteHours,
    provenance: input.visitCountOverride != null ? "participant_entered" : schedule.provenance,
  });

  const travelMinutes = input.travelOverrideMinutes ?? input.oneWayTravelMinutes;
  let travelHours: number | null = null;
  if (travelMinutes != null) {
    travelHours = round1((visitCount * 2 * travelMinutes) / 60);
    lines.push({
      label: "Travel",
      detail: `${visitCount} round trips × ${formatMinutes(travelMinutes)} each way`,
      hours: travelHours,
      provenance: "participant_entered",
    });
  } else {
    lines.push({
      label: "Travel",
      detail: "You have not entered a travel time yet, so travel is not included below.",
      hours: null,
      provenance: "unknown",
    });
    openQuestions.push("How long would it take you to reach the study site?");
  }

  let remoteHours: number | null = null;
  if (schedule.remoteContacts.length > 0) {
    remoteHours = round1(
      schedule.remoteContacts.reduce((sum, contact) => sum + contact.minutes, 0) / 60
    );
    lines.push({
      label: "Remote contacts",
      detail: schedule.remoteContacts
        .map((contact) => `${contact.name} (${formatMinutes(contact.minutes)})`)
        .join(", "),
      hours: remoteHours,
      provenance: schedule.provenance,
    });
  }

  const partial = travelHours == null;
  const totalHours = round1(onSiteHours + (travelHours ?? 0) + (remoteHours ?? 0));

  // The formula must add up to the total shown beside it. When every visit is
  // the same length the compact form is clearer, but remote contacts still have
  // to appear in it — otherwise the arithmetic visibly fails to reach the total.
  const remoteTerm = remoteHours ? ` + ${remoteHours}h remote contact` : "";
  const uniformVisits =
    input.visitCountOverride == null &&
    allVisits.every((visit) => visit.onSiteHours === allVisits[0].onSiteHours);

  const formula =
    travelMinutes != null && uniformVisits
      ? `${visitCount} × (${allVisits[0].onSiteHours}h on site + 2 × ${formatMinutes(travelMinutes)} travel)${remoteTerm} = ${totalHours}h`
      : travelMinutes != null
        ? `${onSiteHours}h on site + ${travelHours}h travel${remoteTerm} = ${totalHours}h`
        : `${onSiteHours}h on site${remoteTerm} = ${totalHours}h, travel not included`;

  const weeks = allVisits.length
    ? Math.max(...allVisits.map((visit) => visit.weekOffset)) -
      Math.min(...allVisits.map((visit) => visit.weekOffset))
    : null;

  const logistics = trial.knownLogistics;
  if (logistics) {
    if (!logistics.travelReimbursementStated) {
      openQuestions.push("Is travel or mileage reimbursed?");
    }
    if (!logistics.parkingReimbursementStated) {
      openQuestions.push("Is parking covered or validated at the study site?");
    }
    if (!logistics.caregiverAccommodationStated) {
      openQuestions.push("Can someone come with me to visits, and is there anywhere for them to wait?");
    }
    if (!logistics.remoteVisitOptionStated) {
      openQuestions.push("Can any visits be done remotely or closer to home?");
    }
  }

  if (profile.workConstraints) {
    openQuestions.push("Can visits be scheduled early in the day so I lose less work time?");
  }

  return {
    available: true,
    unavailableReason: null,
    scheduleProvenance: schedule.provenance,
    scheduleConfirmedOn: schedule.confirmedOn,
    visitCount, onSiteHours, travelHours, remoteHours, totalHours,
    partial, formula, lines, exclusions,
    openQuestions: [...new Set(openQuestions)],
    hypothetical,
    weeksSpanned: weeks,
  };
}
