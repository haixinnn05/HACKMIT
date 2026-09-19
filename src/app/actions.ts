"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addSavedReply, audit, clearTodos, createGrant, deleteSavedReply, findHandoffTokenByPassNumber, deleteQuestionDraft, getQuestion, saveQuestionDraft, createInquiry, createQuestion, ensureTodo, getParticipant, getTrial,
  listQuestions, recordMilestone, setPersonalNote, revokeGrant, saveTrial, setInquiryState, toggleTodo,
  unsaveTrial, updateParticipant, updateQuestion, upsertEnrollment,
} from "@/lib/repo";
import { assessTrial } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { draftInquiry } from "@/lib/ai";
import { getActiveParticipant, setRole, STAFF } from "@/lib/session";
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
      ? "Harborview Cancer Center, Cambridge (simulated site account)"
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

export async function coordinatorAcknowledgeAction(formData: FormData) {
  const inquiryId = String(formData.get("inquiryId"));
  // Acknowledging is not enrolment, and the participant-facing copy says so.
  setInquiryState(inquiryId, "acknowledged");
  audit("coord-fixture-1", "inquiry.acknowledged", inquiryId);
  revalidatePath(`/clinic/inbox/${inquiryId}`);
  revalidatePath("/clinic", "layout");
}

export async function coordinatorRequestInfoAction(formData: FormData) {
  const inquiryId = String(formData.get("inquiryId"));
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
      answeredBy: "R. Alvarez, Research Coordinator (simulated staff account)",
    });
    deleteQuestionDraft(questionId);
    setInquiryState(inquiryId, "answered");
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
 * Records what the person decided. Declining is a first-class outcome with the
 * same weight as accepting — it closes the loop rather than leaving the inquiry
 * open, and it never removes access to anything.
 */
export async function decideAction(formData: FormData) {
  const participant = await getActiveParticipant();
  const trialId = String(formData.get("trialId"));
  const decision = String(formData.get("decision"));
  const trial = getTrial(trialId);
  if (!trial) return;

  if (decision === "declined") {
    upsertEnrollment({ participantId: participant.id, trialId, status: "declined", visits: [] });
    clearTodos(participant.id, trialId);
    const inquiryId = String(formData.get("inquiryId") ?? "");
    if (inquiryId) setInquiryState(inquiryId, "closed", "Participant decided not to continue.");
  } else if (decision === "participating") {
    // Visit dates come from the confirmed schedule only. Without one there is no
    // calendar, because inventing dates would be inventing a commitment.
    const schedule = trial.visitSchedule;
    const start = new Date();
    const visits = (schedule?.visits ?? []).map((visit) => {
      const date = new Date(start);
      date.setDate(date.getDate() + visit.weekOffset * 7);
      return {
        name: visit.name,
        date: date.toISOString().slice(0, 10),
        onSiteHours: visit.onSiteHours,
        location: trial.sites[0]?.facility ?? null,
      };
    });
    upsertEnrollment({ participantId: participant.id, trialId, status: "participating", visits });

    // To-dos come from what the study's own material leaves unstated. They are
    // prompts to ask, never claims about what the site provides.
    const logistics = trial.knownLogistics;
    if (!logistics?.parkingReimbursementStated) ensureTodo(participant.id, trialId, "parking", "Confirm parking details");
    ensureTodo(participant.id, trialId, "travel", "Plan travel arrangements");
    ensureTodo(participant.id, trialId, "bring", "Ask what to bring");
  } else if (decision === "help") {
    // "Please help me contact the study team": routed to staff as a question,
    // never answered by the app.
    createQuestion({
      participantId: participant.id, trialId, category: "general",
      text: "Please help me contact the study team directly.",
      inquiryId: String(formData.get("inquiryId") ?? "") || null,
    });
    upsertEnrollment({ participantId: participant.id, trialId, status: "considering", visits: [] });
  } else {
    upsertEnrollment({ participantId: participant.id, trialId, status: "considering", visits: [] });
  }

  audit(participant.id, `decision.${decision}`, trialId);
  revalidatePath("/timeline");
  revalidatePath("/inbox");
  revalidatePath("/");
  revalidatePath("/passport");
  revalidatePath(`/trial/${trialId}`);
  // Agreeing leads straight to the visits it created.
  if (decision === "participating") redirect("/timeline");
  if (decision === "declined") redirect("/inbox?tab=archived");
}

/** Builds the editable draft shown on the inquiry preview screen. */
export async function buildDraft(trialId: string, participantId: string) {
  const participant = getParticipant(participantId)!;
  const trial = getTrial(trialId)!;
  const assessment = assessTrial(trial, participant);
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
    if (question.inquiryId) setInquiryState(question.inquiryId, "acknowledged");
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
