"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addSavedReply, audit, clearEnrollment, clearTodos, createGrant, deleteSavedReply, findHandoffTokenByPassNumber, deleteQuestionDraft, getQuestion, saveQuestionDraft, createInquiry, createQuestion, ensureTodo, getInquiry, getOpenInquiryForTrial, getParticipant, getParticipatingEnrollment, getTrial,
  listConfirmedCriterionIds, listEnrollments, listQuestions, recordMilestone, setCriterionCheck, setPersonalNote, revokeGrant, saveTrial, setInquiryState, toggleTodo,
  unsaveTrial, updateParticipant, updateQuestion, upsertEnrollment,
} from "@/lib/repo";
import { assessTrial } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { draftInquiry } from "@/lib/ai";
import { getActiveParticipant, setRole, clearRole, STAFF } from "@/lib/session";
import { autofill, formFor } from "@/lib/application";
import { getFictionalFixture } from "@/lib/db";
import type { ClinicalFact } from "@/lib/types";

/* Server actions. Every outbound or state-changing step is an explicit user
 * action here — nothing in the model layer can reach these. */

export async function toggleSaveAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  if (formData.get("saved") === "true") unsaveTrial(participant.id, trialId);
  else saveTrial(participant.id, trialId);
  revalidatePath(`/trial/${trialId}`);
  revalidatePath("/passport");
}

export async function addQuestionAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;

  // Clinical questions are routed to qualified staff and labelled as such; the
  // product never answers them itself.
  const category = /dose|side effect|safety|risk|drug|treatment|prognosis|survival|work for me|should i/i.test(text)
    ? "clinical"
    : /cost|pay|reimburse|insurance|money|compensation/i.test(text)
      ? "financial"
      : /travel|park|visit|time|schedule|transport|ride|appointment|child|work/i.test(text)
        ? "logistics"
        : "general";

  createQuestion({ participantId: participant.id, trialId, text, category });
  revalidatePath("/questions");
  revalidatePath(`/trial/${trialId}`);
  // Only same-origin paths are honoured, so this cannot be used as an open redirect.
  const returnTo = String(formData.get("returnTo") ?? "");
  if (returnTo.startsWith("/") && !returnTo.startsWith("//")) redirect(returnTo);
}

export async function removeQuestionAction(formData: FormData) {
  const { getDb } = await import("@/lib/db");
  const participant = await getActiveParticipant();
  const id = String(formData.get("questionId"));
  const trialId = String(formData.get("trialId"));
  // Scoped by participant so one person can never delete another's question.
  getDb().prepare("DELETE FROM questions WHERE id = ? AND participant_id = ? AND state = 'open'")
    .run(id, participant.id);
  revalidatePath("/questions");
  revalidatePath(`/trial/${trialId}`);
}

export async function markReviewedAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  recordMilestone(participant.id, "reviewed_overview", "Reviewed the study overview", trialId);
  revalidatePath(`/trial/${trialId}`);
  revalidatePath("/passport");
}

/** Share the inquiry. This is the only path that discloses anything, and it
 *  records the grant, the exact payload and an audit event. */
export async function shareInquiryAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  // The note is the person's own words; the packet is the editable, autofilled
  // summary that travels with it.
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const packet = String(formData.get("packet") ?? formData.get("message") ?? "").trim();
  const message = [note, packet].filter(Boolean).join("\n\n");
  const trial = getTrial(trialId);
  if (!trial) return;
  const tookPart = listEnrollments(participant.id).some((entry) => entry.trialId === trialId && entry.status === "completed");
  if (tookPart) redirect(`/trial/${trialId}`);
  const underway = getParticipatingEnrollment(participant.id);
  if (underway && underway.trialId !== trialId) redirect("/");
  const existing = getOpenInquiryForTrial(participant.id, trialId);
  if (existing) redirect(`/inquiry/${existing.id}`);

  const selected = formData.getAll("field").map(String);
  const payload: Record<string, unknown> = {};
  if (selected.includes("basics")) {
    payload.displayName = participant.displayName;
    payload.ageYears = participant.ageYears;
    payload.location = [participant.city, participant.state].filter(Boolean).join(", ");
  }
  if (selected.includes("condition")) {
    payload.condition = participant.condition;
    payload.conditionDetail = participant.conditionDetail;
    payload.clinicalFacts = participant.clinicalFacts;
  }
  if (selected.includes("practical")) {
    payload.oneWayTravelMinutes = participant.oneWayTravelMinutes;
    payload.maxTravelMinutes = participant.maxTravelMinutes;
    payload.needsTravelHelp = participant.needsTravelHelp;
    payload.caregiverAvailable = participant.caregiverAvailable;
    payload.workConstraints = participant.workConstraints;
  }
  if (selected.includes("contact")) payload.contact = participant.contact;

  const grant = createGrant({
    participantId: participant.id,
    recipientLabel: trial.isFictional
      ? "Harborview Cancer Center, Cambridge"
      : `${trial.leadSponsor ?? "Study team"}, ${trial.id}`,
    trialId,
    allowedFields: selected,
    purpose: "Inquiry about taking part",
  });

  const inquiry = createInquiry({
    participantId: participant.id, trialId, grantId: grant.id, message, sharedFields: payload,
  });

  // Attach the participant's open questions to the inquiry so the coordinator
  // sees them as owned work rather than loose text in a message.
  // Questions travel only when the person ticked them.
  if (selected.includes("questions")) {
    const { getDb } = await import("@/lib/db");
    getDb()
      .prepare("UPDATE questions SET inquiry_id = ? WHERE participant_id = ? AND trial_id = ? AND inquiry_id IS NULL")
      .run(inquiry.id, participant.id, trialId);
  }
  revalidatePath("/inbox");
  revalidatePath("/questions");
  revalidatePath("/passport");
  revalidatePath("/clinic", "layout");
  revalidatePath(`/trial/${trialId}`);
  revalidatePath("/profile/saved");
  redirect(`/inquiry/${inquiry.id}`);
}

export async function revokeGrantAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const grantId = String(formData.get("grantId"));
  const { getGrant } = await import("@/lib/repo");
  const grant = getGrant(grantId);
  // Authorization check: a grant can only be revoked by the person who made it.
  if (!grant || grant.participantId !== participant.id) return;
  revokeGrant(grantId);
  revalidatePath("/passport");
  revalidatePath("/clinic", "layout");
}

export async function updateProfileAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const num = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? null : Number(raw);
  };

  // Facts keep their "I don't know" state. An empty box means unknown, not "no".
  const facts: ClinicalFact[] = participant.clinicalFacts.map((fact) => {
    const raw = String(formData.get(`fact_${fact.key}`) ?? "").trim();
    return raw === ""
      ? { ...fact, value: null, provenance: "unknown" }
      : { ...fact, value: raw, provenance: "self_reported" };
  });

  updateParticipant(participant.id, {
    condition: String(formData.get("condition") ?? "") || null,
    conditionDetail: String(formData.get("conditionDetail") ?? "") || null,
    ageYears: num("ageYears"),
    maxTravelMinutes: num("maxTravelMinutes"),
    oneWayTravelMinutes: num("oneWayTravelMinutes"),
    workConstraints: String(formData.get("workConstraints") ?? "") || null,
    needsTravelHelp: formData.get("needsTravelHelp") === "on",
    caregiverAvailable: formData.get("caregiverAvailable") === "on",
    clinicalFacts: facts,
  });
  if (formData.has("personalNote")) setPersonalNote(participant.id, String(formData.get("personalNote") ?? ""));
  audit(participant.id, "profile.updated", participant.id);
  revalidatePath("/profile");
  revalidatePath("/passport");
  revalidatePath("/explore");
}

/* ------------------------------------------------------------- coordinator */

function enrollInStudy(participantId: string, trialId: string) {
  const trial = getTrial(trialId);
  if (!trial) return false;
  const underway = getParticipatingEnrollment(participantId);
  if (underway && underway.trialId !== trialId) return false;
  if (underway?.trialId === trialId) return true;

  const start = new Date();
  const visits = (trial.visitSchedule?.visits ?? []).map((visit) => {
    const date = new Date(start);
    date.setDate(date.getDate() + visit.weekOffset * 7);
    return {
      name: visit.name,
      date: date.toISOString().slice(0, 10),
      onSiteHours: visit.onSiteHours,
      location: trial.sites[0]?.facility ?? null,
    };
  });
  upsertEnrollment({ participantId, trialId, status: "participating", visits });

  const logistics = trial.knownLogistics;
  if (!logistics?.parkingReimbursementStated) ensureTodo(participantId, trialId, "parking", "Confirm parking details");
  ensureTodo(participantId, trialId, "travel", "Plan travel arrangements");
  ensureTodo(participantId, trialId, "bring", "Ask what to bring");
  return true;
}

export async function coordinatorAcknowledgeAction(formData: FormData) {
  const inquiryId = String(formData.get("inquiryId"));
  const inquiry = getInquiry(inquiryId);
  if (!inquiry || inquiry.state === "approved" || inquiry.state === "closed") return;
  // Acknowledging is not enrolment, and the participant-facing copy says so.
  setInquiryState(inquiryId, "acknowledged");
  audit("coord-fixture-1", "inquiry.acknowledged", inquiryId);
  revalidatePath(`/clinic/inbox/${inquiryId}`);
  revalidatePath("/clinic", "layout");
}

export async function coordinatorApproveAction(formData: FormData) {
  const inquiryId = String(formData.get("inquiryId"));
  const inquiry = getInquiry(inquiryId);
  if (!inquiry || inquiry.state === "closed" || inquiry.state === "draft") return;
  if (!enrollInStudy(inquiry.participantId, inquiry.trialId)) return;
  setInquiryState(inquiryId, "approved");
  audit("coord-fixture-1", "inquiry.approved", inquiryId);
  revalidatePath(`/clinic/inbox/${inquiryId}`);
  revalidatePath(`/inquiry/${inquiryId}`);
  revalidatePath("/clinic", "layout");
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/timeline");
  revalidatePath("/passport");
  revalidatePath(`/trial/${inquiry.trialId}`);
}

export async function coordinatorRequestInfoAction(formData: FormData) {
  const inquiryId = String(formData.get("inquiryId"));
  const inquiry = getInquiry(inquiryId);
  if (!inquiry || inquiry.state === "approved" || inquiry.state === "closed") return;
  setInquiryState(inquiryId, "needs_information", String(formData.get("note") ?? ""));
  audit("coord-fixture-1", "inquiry.needs_information", inquiryId);
  revalidatePath(`/clinic/inbox/${inquiryId}`);
  revalidatePath("/clinic", "layout");
}

/**
 * The human-reviewed reply. A coordinator can save a draft, which the
 * participant never sees, or send the answer, which they do. Nothing is sent
 * without a person pressing Send.
 */
export async function coordinatorAnswerAction(formData: FormData) {
  const questionId = String(formData.get("questionId"));
  const inquiryId = String(formData.get("inquiryId"));
  const answer = String(formData.get("answer") ?? "").trim();
  const citation = String(formData.get("citation") ?? "").trim() || null;
  if (!answer) return;

  if (formData.get("intent") === "draft") {
    saveQuestionDraft(questionId, answer, citation);
    updateQuestion(questionId, { state: "draft_answer" });
    audit("coord-fixture-1", "question.draft_saved", questionId);
  } else {
    updateQuestion(questionId, {
      state: "reviewed_answer", answer, answerCitation: citation,
      answeredBy: "R. Alvarez, Research Coordinator",
    });
    deleteQuestionDraft(questionId);
    const inquiry = getInquiry(inquiryId);
    if (inquiry && inquiry.state !== "approved") setInquiryState(inquiryId, "answered");
    audit("coord-fixture-1", "question.answered", questionId);
  }
  revalidatePath(`/clinic/inbox/${inquiryId}`);
  revalidatePath(`/inquiry/${inquiryId}`);
  revalidatePath("/clinic", "layout");
  revalidatePath("/inbox");
  revalidatePath("/questions");
  revalidatePath("/");
}

export async function coordinatorAssignAction(formData: FormData) {
  const questionId = String(formData.get("questionId"));
  const inquiryId = String(formData.get("inquiryId"));
  const assignee = String(formData.get("assignee") ?? "");
  updateQuestion(questionId, { state: "assigned", assignedTo: assignee });
  audit("coord-fixture-1", "question.assigned", questionId, assignee);
  revalidatePath(`/clinic/inbox/${inquiryId}`);
}

/* ------------------------------------------------------- participant choices */

/**
 * Records what the person decided. Taking part is approved on the clinic side,
 * not here. Declining closes the loop rather than leaving the inquiry open.
 */
export async function decideAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  const decision = String(formData.get("decision"));
  const trial = getTrial(trialId);
  if (!trial) return;
  const inquiryId = String(formData.get("inquiryId") ?? "");
  const inquiry = inquiryId ? getInquiry(inquiryId) : null;
  // A closed inquiry is finished. Contacting the team again means sending a
  // new application, not flipping this one back open.
  if (inquiry?.state === "closed") return;

  if (decision === "declined") {
    upsertEnrollment({ participantId: participant.id, trialId, status: "declined", visits: [] });
    clearTodos(participant.id, trialId);
    if (inquiryId) setInquiryState(inquiryId, "closed", "Participant decided not to continue.");
  } else if (decision === "help") {
    // "Please help me contact the study team": routed to staff as a question,
    // never answered by the app.
    createQuestion({
      participantId: participant.id, trialId, category: "general",
      text: "Please help me contact the study team directly.",
      inquiryId: String(formData.get("inquiryId") ?? "") || null,
    });
    upsertEnrollment({ participantId: participant.id, trialId, status: "considering", visits: [] });
  }

  audit(participant.id, `decision.${decision}`, trialId);
  revalidatePath("/timeline");
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/passport");
  revalidatePath(`/trial/${trialId}`);
  if (decision === "declined") redirect("/inbox?tab=archived");
}

/** Builds the editable draft shown on the inquiry preview screen. */
export async function buildDraft(trialId: string, participantId: string) {
  const participant = getParticipant(participantId)!;
  const trial = getTrial(trialId)!;
  const assessment = assessTrial(trial, participant, listConfirmedCriterionIds(participant.id, trialId));
  const burden = computeBurden(trial, participant);
  const questions = listQuestions({ participantId, trialId })
    .filter((question) => question.state === "open")
    .map((question) => question.text);
  return draftInquiry({ profile: participant, trial, assessment, burden, questions });
}

export async function toggleTodoAction(formData: FormData) {
  const participant = await getActiveParticipant();
  toggleTodo(String(formData.get("todoId")), participant.id);
  revalidatePath("/timeline");
  revalidatePath("/");
}

export async function toggleCriterionCheckAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId") ?? "");
  const criterionId = String(formData.get("criterionId") ?? "");
  const trial = getTrial(trialId);
  if (!trial || !criterionId) return;

  const allowed = new Set(assessTrial(trial, participant).assessments.map((item) => item.criterionId));
  if (!allowed.has(criterionId)) return;

  const already = listConfirmedCriterionIds(participant.id, trialId).includes(criterionId);
  setCriterionCheck(participant.id, trialId, criterionId, !already);
  revalidatePath(`/trial/${trialId}`);
  revalidatePath("/explore");
}

/**
 * Logistics check-in: "Is anything making your next visit difficult?"
 * An explicit request for help becomes a question owned by study staff. There
 * is no risk score and nothing is inferred from silence.
 */
export async function requestVisitHelpAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return;
  createQuestion({ participantId: participant.id, trialId, category: "logistics", text: `Help with my next visit: ${text}` });
  revalidatePath("/timeline");
  revalidatePath("/questions");
}

export async function resetDemoAction() {
  const { resetDemoData } = await import("@/lib/db");
  resetDemoData();
  revalidatePath("/", "layout");
  redirect("/");
}

/** The participant closes a question, or says the answer did not settle it. */
export async function questionFollowUpAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const question = getQuestion(String(formData.get("questionId")));
  // Only the person who asked can resolve or reopen their question.
  if (!question || question.participantId !== participant.id) return;

  if (formData.get("intent") === "reopen") {
    // The earlier answer stays as history; the question is simply open again.
    updateQuestion(question.id, { state: "open", assignedTo: null });
    if (question.inquiryId) {
      const inquiry = getInquiry(question.inquiryId);
      if (inquiry && inquiry.state !== "approved") setInquiryState(question.inquiryId, "acknowledged");
    }
    audit(participant.id, "question.reopened", question.id);
  } else {
    updateQuestion(question.id, { state: "resolved" });
    audit(participant.id, "question.resolved", question.id);
  }
  if (question.inquiryId) revalidatePath(`/inquiry/${question.inquiryId}`);
  revalidatePath("/questions");
  revalidatePath("/inbox");
  revalidatePath("/clinic", "layout");
}

/* ------------------------------------------------------------- the two faces */

export async function chooseRoleAction(formData: FormData) {
  const role = formData.get("role") === "clinic" ? "clinic" : "participant";
  await setRole(role);
  redirect(role === "clinic" ? "/clinic" : "/");
}

export async function signOutAction() {
  await clearRole();
  redirect("/login");
}

/**
 * Opens a participant's in-person passport from the pass number on their ticket.
 * A wrong, expired and revoked number all fail the same way, so the form cannot
 * be used to learn which codes exist.
 */
export async function openPassAction(formData: FormData) {
  const token = findHandoffTokenByPassNumber(String(formData.get("pass") ?? ""));
  audit(STAFF.id, token ? "pass.opened" : "pass.not_found", "in-person passport");
  redirect(token ? `/handoff/${token}?from=clinic` : "/clinic/scan?missed=1");
}

export async function addSavedReplyAction(formData: FormData) {
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "").toLowerCase().split(",").map((k) => k.trim()).filter(Boolean);
  if (!answer || keywords.length === 0) return;
  addSavedReply({
    trialId: String(formData.get("trialId")), keywords, answer,
    citation: String(formData.get("citation") ?? "").trim() || null,
  });
  audit(STAFF.id, "reply.saved", keywords.join(", "));
  revalidatePath("/clinic/studies");
}

export async function deleteSavedReplyAction(formData: FormData) {
  deleteSavedReply(String(formData.get("replyId")));
  audit(STAFF.id, "reply.deleted", String(formData.get("replyId")));
  revalidatePath("/clinic/studies");
}

/* --------------------------------------------------------------- application */

/**
 * Submits a study's application form.
 *
 * Only what is in the submitted form is shared, so every value was on screen and
 * editable first. Blank fields are dropped rather than sent as empty. Contact
 * details go only if the person ticked them. Each answer keeps a note of whether
 * it came from the passport or was typed here, which the coordinator can see.
 */
export async function submitApplicationAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  const trial = getTrial(trialId);
  if (!trial) return;
  const tookPart = listEnrollments(participant.id).some((entry) => entry.trialId === trialId && entry.status === "completed");
  if (tookPart) redirect(`/trial/${trialId}`);
  const underway = getParticipatingEnrollment(participant.id);
  if (underway && underway.trialId !== trialId) redirect("/");
  const existing = getOpenInquiryForTrial(participant.id, trialId);
  if (existing) redirect(`/inquiry/${existing.id}`);

  const form = formFor(trial, getFictionalFixture()?.applicationForm);
  const filled = autofill(participant, form);
  const includeContact = formData.get("includeContact") === "on";

  const answers = filled
    .filter((field) => field.section !== "Contact" || includeContact)
    .map((field) => {
      const value = String(formData.get(`f_${field.id}`) ?? "").trim().slice(0, 600);
      return { id: field.id, label: field.label, value, section: field.section,
        origin: value && value === field.value ? "from passport" : "typed on the form" };
    })
    .filter((answer) => answer.value !== "");

  // Reusable information: new answers can flow back so the next form is fuller.
  if (formData.get("saveBack") === "on") {
    const facts = participant.clinicalFacts.map((fact) => {
      const field = filled.find((f) => f.source === `fact:${fact.key}`);
      const typed = field ? String(formData.get(`f_${field.id}`) ?? "").trim() : "";
      return typed && typed !== fact.value ? { ...fact, value: typed, provenance: "self_reported" as const } : fact;
    });
    const minutes = Number(formData.get("f_travel_minutes"));
    updateParticipant(participant.id, {
      clinicalFacts: facts,
      oneWayTravelMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : participant.oneWayTravelMinutes,
      workConstraints: String(formData.get("f_work") ?? "").trim() || participant.workConstraints,
    });
  }

  const byId = Object.fromEntries(answers.map((answer) => [answer.id, answer.value]));
  const grant = createGrant({
    participantId: participant.id,
    recipientLabel: trial.isFictional ? "Harborview Cancer Center, Cambridge (simulated site account)" : `${trial.leadSponsor ?? "Study team"} (${trial.id})`,
    trialId,
    allowedFields: ["basics", "application", "questions", ...(includeContact ? ["contact"] : [])],
    purpose: "Inquiry about taking part",
  });
  const inquiry = createInquiry({
    participantId: participant.id, trialId, grantId: grant.id,
    message: `Submitted the ${form.title}, with ${answers.length} answers.`,
    sharedFields: { displayName: byId.name ?? null, ageYears: byId.age ?? null, location: byId.location ?? null, application: answers },
  });
  const declined = listEnrollments(participant.id).find((entry) => entry.trialId === trialId);
  if (declined?.status === "declined") clearEnrollment(participant.id, trialId);
  const { getDb } = await import("@/lib/db");
  getDb()
    .prepare("UPDATE questions SET inquiry_id = ? WHERE participant_id = ? AND trial_id = ? AND inquiry_id IS NULL")
    .run(inquiry.id, participant.id, trialId);
  audit(participant.id, "inquiry.shared", trialId, `${answers.length} answers`);
  revalidatePath("/inbox");
  revalidatePath("/clinic", "layout");
  redirect(`/inquiry/${inquiry.id}`);
}

/* --------------------------------------------------------------------- peers */

export async function savePeerOptInAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const { savePeerOptIn, removePeerOptIn } = await import("@/lib/peer-repo");
  const { PEER_FIELDS } = await import("@/lib/peers");
  if (formData.get("intent") === "leave") {
    removePeerOptIn(participant.id);
    audit(participant.id, "peers.opted_out", participant.id);
  } else {
    const allowed = new Set<string>(PEER_FIELDS.map((field) => field.id));
    const offers = formData.getAll("offer").map(String).filter((id) => allowed.has(id));
    // An alias, never the real name: connecting reveals what each person offered and nothing else.
    const alias = String(formData.get("alias") ?? "").trim().slice(0, 24) || "A fellow patient";
    savePeerOptIn({
      participantId: participant.id, alias, offers: offers as never,
      about: String(formData.get("about") ?? "").trim().slice(0, 160) || null,
    });
    audit(participant.id, "peers.opted_in", participant.id, offers.join(", "));
  }
  revalidatePath("/peers");
  redirect(String(formData.get("returnTo") ?? "/peers").startsWith("/peers") ? String(formData.get("returnTo") ?? "/peers") : "/peers");
}

export async function requestPeerAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const { createPeerConnection, findPeerMatches } = await import("@/lib/peer-repo");
  const trialId = String(formData.get("trialId") ?? "") || null;
  const toId = String(formData.get("toId"));
  // Re-run the match on the server. A request is only possible to someone the
  // matcher actually suggested, so the form cannot be used to reach anyone else.
  const outcome = findPeerMatches(participant.id, trialId);
  const match = outcome.status === "ok" ? outcome.matches.find((m) => m.participantId === toId) : null;
  if (!match) return;
  const connection = createPeerConnection({
    trialId, fromId: participant.id, toId, reasons: match.reasons,
    note: String(formData.get("note") ?? "").trim().slice(0, 240) || null,
  });
  audit(participant.id, "peers.requested", connection.id);
  revalidatePath("/peers");
  redirect(`/peers/${connection.id}`);
}

export async function respondPeerAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const { getPeerConnection, setPeerConnectionState } = await import("@/lib/peer-repo");
  const connection = getPeerConnection(String(formData.get("connectionId")));
  if (!connection || (connection.fromId !== participant.id && connection.toId !== participant.id)) return;
  const intent = String(formData.get("intent"));

  if (intent === "accept" && connection.toId === participant.id && connection.state === "pending") setPeerConnectionState(connection.id, "accepted");
  else if (intent === "decline" && connection.toId === participant.id && connection.state === "pending") setPeerConnectionState(connection.id, "declined");
  else if (intent === "end") setPeerConnectionState(connection.id, "ended");
  else if (intent === "report") setPeerConnectionState(connection.id, "reported");
  else return;

  audit(participant.id, `peers.${intent}`, connection.id);
  revalidatePath("/peers");
  revalidatePath(`/peers/${connection.id}`);
  if (intent !== "accept") redirect("/peers");
}

export async function sendPeerMessageAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const { addPeerMessage, getPeerConnection } = await import("@/lib/peer-repo");
  const connection = getPeerConnection(String(formData.get("connectionId")));
  const text = String(formData.get("text") ?? "").trim();
  // Only the two people in an accepted connection can write to it.
  if (!connection || connection.state !== "accepted" || !text) return;
  if (connection.fromId !== participant.id && connection.toId !== participant.id) return;
  addPeerMessage(connection.id, participant.id, text);
  revalidatePath(`/peers/${connection.id}`);
  // Back to the bare URL, so a suggested starter does not linger in the box and get sent twice.
  redirect(`/peers/${connection.id}#compose`);
}
