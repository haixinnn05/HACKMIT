import { notFound } from "next/navigation";
import { Card, DataRow, Pill, ScreenHeader, SectionHeading, StickyAction } from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import { getGrant, getInquiry, getParticipant, getQuestionDraft, getTrial, isGrantActive, listQuestions, listSavedReplies } from "@/lib/repo";
import { coordinatorAcknowledgeAction, coordinatorAnswerAction, coordinatorAssignAction, coordinatorRequestInfoAction } from "@/app/actions";
import type { CriterionAssessment } from "@/lib/types";
import { isAnswered, QUESTION_STATE_LABEL, SITE_STAFF } from "@/lib/questions";

export const dynamic = "force-dynamic";

/**
 * One inquiry, from the coordinator's side.
 *
 * It exists to save the intake and clarification a coordinator repeats on every
 * first contact: the participant's own words, criterion observations with their
 * source wording, an explicit list of what is missing, and a reply a person
 * writes or edits before it is sent. A saved site-policy answer may be offered
 * for logistics questions. It is never sent automatically.
 */
export default async function CoordinatorInquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = getInquiry(id);
  if (!inquiry) notFound();

  const grant = inquiry.grantId ? getGrant(inquiry.grantId) : null;
  // The grant is the authorization. Without an active one there is nothing to show.
  if (!isGrantActive(grant)) {
    return (
      <div className="space-y-4">
        <ScreenHeader back="/clinic/inbox" title="No longer available" />
        <Card className="p-5 text-[13.5px] leading-relaxed text-ink-soft">
          The participant revoked access, or the sharing grant expired. Nothing further can be read
          here. If you already recorded details elsewhere, your institution&rsquo;s retention rules apply
          to that copy. Revoking access in this app cannot recall it.
        </Card>
      </div>
    );
  }

  const participant = getParticipant(inquiry.participantId);
  const trial = getTrial(inquiry.trialId);
  if (!participant || !trial) notFound();

  const allowed = new Set(grant!.allowedFields);
  const shared = inquiry.sharedFields as Record<string, unknown>;
  const application = Array.isArray(shared.application) ? shared.application as { id: string; label: string; value: string; origin: string }[] : [];
  const name = allowed.has("basics") ? participant.displayName.replace(/\s*\(synthetic\)$/, "") : "Participant";
  const assessment = assessTrial(trial, participant);
  const questions = listQuestions({ inquiryId: inquiry.id });
  // The site's own reply library, managed under Studies.
  const canned = listSavedReplies(trial.id);
  const note = inquiry.message.split("\n\n")[0];

  const by = (status: CriterionAssessment["status"]) => assessment.assessments.filter((a) => a.status === status);
  const considerations: { label: string; tone: "mint" | "iris" | "peach" | "blush"; items: CriterionAssessment[] }[] = [
    { label: "Supported", tone: "mint", items: by("supported") },
    { label: "Unknown", tone: "iris", items: by("unknown") },
    { label: "Needs review", tone: "peach", items: [...by("conflict"), ...by("needs_clinical_review")] },
  ];

  return (
    <div className="space-y-4">
      <ScreenHeader back="/clinic/inbox" title={name} sub={trial.briefTitle ?? trial.id} />

      <div>
        <p className="text-[13px] text-ink-soft">
          {allowed.has("basics")
            ? [participant.ageYears != null ? `Age ${participant.ageYears}` : null, participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null, [participant.state, "USA"].filter(Boolean).join(", ")].filter(Boolean).join(", ")
            : "Personal details not shared"}
        </p>
        {note ? <p className="mt-2 rounded-[16px] bg-lavender px-4 py-3 text-[13px] leading-relaxed text-ink">&ldquo;{note}&rdquo;</p> : null}
      </div>

      <section aria-labelledby="considerations-heading">
        <SectionHeading id="considerations-heading">
          Eligibility Considerations
        </SectionHeading>
        <Card className="overflow-hidden">
          {considerations.map((group) => (
            <details key={group.label} className="group border-b border-rule last:border-0">
              <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2.5">
                <Pill tone={group.tone}>{group.label}</Pill>
                <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-soft">
                  {group.items.length === 0 ? "None" : group.items.slice(0, 2).map((item) => (
                    <span key={item.criterionId} className="block truncate">{item.criterionText}</span>
                  ))}
                </span>
                <span className="text-[12px] font-bold text-ink">{group.items.length}</span>
              </summary>
              <ul className="space-y-2.5 px-4 pb-4">
                {group.items.map((item) => (
                  <li key={item.criterionId} className="rounded-[14px] border border-rule p-3">
                    <p className="text-[12.5px] leading-relaxed text-ink-soft">{item.rationale}</p>
                    <blockquote className="source-quote mt-2">{item.evidenceSpan}</blockquote>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {trial.id} eligibility criteria{item.sourceStart >= 0 ? `, characters ${item.sourceStart} to ${item.sourceEnd}` : ""}, record version {trial.lastUpdatePostDate ?? "unknown"}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </Card>
      </section>

      {assessment.missingInformation.length ? (
        <Card className="p-4">
          <p className="text-[13.5px] font-bold text-ink">Missing information to request</p>
          <ul className="mt-1.5 space-y-1">
            {assessment.missingInformation.map((missing) => (
              <li key={missing.key} className="text-[12.5px] text-ink-soft">
                {missing.label}, would resolve {missing.affectedCriteria} requirement{missing.affectedCriteria === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section>
        <SectionHeading>Shared information</SectionHeading>
        <Card className="px-4">
          <dl>
            {Object.entries(shared).filter(([key, value]) => key !== "application" && value != null).map(([key, value]) => (
              <DataRow key={key} label={humanize(key)} value={renderValue(value)} />
            ))}
          </dl>
        </Card>
        {application.length ? (
          <Card className="mt-2.5 px-4">
            <p className="border-b border-rule py-3 text-[13.5px] font-bold text-ink">Application answers ({application.length})</p>
            {application.map((answer) => (
              <div key={answer.id} className="border-b border-rule py-2.5 last:border-0">
                <p className="text-[12px] text-ink-soft">{answer.label}</p>
                <p className="text-[13.5px] font-semibold text-ink">{answer.value}</p>
                <p className="text-[11px] text-ink-faint">{answer.origin}, self-reported</p>
              </div>
            ))}
          </Card>
        ) : null}
        {!allowed.has("contact") ? (
          <p className="mt-2 text-[12px] text-ink-faint">Contact details not shared.</p>
        ) : null}
      </section>

      <section id="reply" className="scroll-mt-6">
        <SectionHeading>
          Questions to answer ({questions.filter((q) => !isAnswered(q)).length} open)
        </SectionHeading>
        <ul className="space-y-3">
          {questions.length === 0 ? <Card as="li" className="p-4 text-[13px] text-ink-soft">This person did not attach any questions.</Card> : null}
          {questions.map((question) => {
            const suggestion = canned.find((entry) => entry.keywords.some((keyword) => question.text.toLowerCase().includes(keyword)));
            const draft = getQuestionDraft(question.id);
            const answered = isAnswered(question);
            const reopened = !answered && Boolean(question.answer);
            return (
              <Card as="li" key={question.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13.5px] font-bold text-ink">{question.text}</p>
                  <Pill tone={answered ? "mint" : question.state === "open" ? "peach" : "iris"}>
                    {reopened && question.state === "open" ? "Reopened" : QUESTION_STATE_LABEL[question.state]}
                  </Pill>
                </div>
                <p className="text-[11.5px] text-ink-faint">
                  {question.assignedTo ? `Owner: ${SITE_STAFF.find((staff) => staff.id === question.assignedTo)?.label ?? question.assignedTo}` : null}
                </p>

                {question.answer ? (
                  <div className={`mt-2.5 rounded-[14px] p-3 ${answered ? "bg-mint-soft" : "bg-sunken"}`}>
                    {reopened ? <p className="mb-1 text-[11px] font-bold text-ink-faint">Earlier answer</p> : null}
                    <p className="text-[13px] leading-relaxed text-ink">{question.answer}</p>
                    <p className="mt-1.5 text-[11px] text-ink-soft">Sent by {question.answeredBy}{question.answerCitation ? `. ${question.answerCitation}` : ""}</p>
                  </div>
                ) : null}

                {!answered ? (
                  <>
                    <form action={coordinatorAssignAction} className="mt-2.5 flex items-end gap-2">
                      <input type="hidden" name="questionId" value={question.id} />
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      <label className="min-w-0 flex-1 text-[12px] font-semibold text-ink-soft">
                        Owner
                        <select name="assignee" defaultValue={question.assignedTo ?? (question.category === "clinical" ? "investigator" : question.category === "financial" ? "finance" : "coordinator")}
                          className="mt-1 min-h-11 w-full rounded-[14px] border border-rule bg-surface px-3 text-[13px] text-ink">
                          {SITE_STAFF.map((staff) => <option key={staff.id} value={staff.id}>{staff.label}</option>)}
                        </select>
                      </label>
                      <button type="submit" className="press min-h-11 shrink-0 rounded-full border border-rule-strong bg-surface px-4 text-[13px] font-bold text-ink hover:bg-sunken">Assign</button>
                    </form>

                    <form action={coordinatorAnswerAction} className="mt-2.5 space-y-2.5">
                      <input type="hidden" name="questionId" value={question.id} />
                      <input type="hidden" name="inquiryId" value={inquiry.id} />
                      {draft ? (
                        <p className="rounded-[12px] bg-sunken px-3 py-2 text-[11.5px] text-ink-soft">A saved draft</p>
                      ) : suggestion ? (
                        <p className="rounded-[12px] bg-sunken px-3 py-2 text-[11.5px] text-ink-soft">You are the author.</p>
                      ) : null}
                      <label className="block text-[12px] font-semibold text-ink-soft">
                        Your answer
                        <textarea name="answer" rows={4} required defaultValue={draft?.draft ?? suggestion?.answer ?? ""}
                          className="mt-1 w-full rounded-[14px] border border-rule bg-surface p-3 text-[13.5px] text-ink" />
                      </label>
                      <label className="block text-[12px] font-semibold text-ink-soft">
                        Where this comes from (shown to the participant)
                        <input name="citation" defaultValue={draft?.citation ?? suggestion?.citation ?? ""}
                          className="mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3 text-[13.5px] text-ink" />
                      </label>
                      <div className="flex gap-2">
                        <button type="submit" name="intent" value="draft" className="press min-h-12 flex-1 rounded-full border border-rule-strong bg-surface text-[13.5px] font-bold text-ink hover:bg-sunken">Save draft</button>
                        <button type="submit" name="intent" value="send" className="press min-h-12 flex-1 rounded-full border border-iris bg-iris-soft text-[13.5px] font-bold text-iris-deep hover:bg-iris hover:text-white">Send this answer</button>
                      </div>
                    </form>
                  </>
                ) : null}
              </Card>
            );
          })}
        </ul>
      </section>

      {questions.some((q) => !isAnswered(q)) ? (
        <StickyAction>
          <a href="#reply" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            Reply to {name.split(" ")[0]}
          </a>
        </StickyAction>
      ) : null}

      <section className="space-y-2.5">
        <SectionHeading>Move this along</SectionHeading>
        <form action={coordinatorAcknowledgeAction}>
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <button type="submit" className="press min-h-12 w-full rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-ink hover:bg-sunken">Acknowledge receipt</button>
        </form>
        <form action={coordinatorRequestInfoAction} className="space-y-2">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <label className="block text-[12px] font-semibold text-ink-soft">
            Ask for something specific
            <input name="note" required placeholder="e.g. We would need your HER2 result before screening."
              className="mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3 text-[13.5px] text-ink placeholder:text-ink-faint" />
          </label>
          <button type="submit" className="press min-h-12 w-full rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-ink hover:bg-sunken">Request information</button>
        </form>
      </section>
    </div>
  );
}

function humanize(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()).trim();
}

function renderValue(value: unknown): string {
  if (value == null || value === "") return "not shared";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) {
    return value.map((item) =>
      item && typeof item === "object" && "label" in item
        ? `${(item as { label: string }).label}: ${(item as { value: string | null }).value ?? "unknown"}`
        : String(item)).join("; ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}: ${entry ?? "not shared"}`).join("; ");
  }
  return String(value);
}
