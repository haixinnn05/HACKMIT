import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, FictionBanner, Note, SectionHeading, StatusChip } from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import {
  getGrant, getInquiry, getParticipant, getTrial, isGrantActive, listQuestions,
} from "@/lib/repo";
import { getFictionalFixture } from "@/lib/db";
import {
  coordinatorAcknowledgeAction, coordinatorAnswerAction, coordinatorRequestInfoAction,
} from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * One inquiry, from the coordinator's side.
 *
 * The point of this screen is to save the repeated intake and clarification work
 * a coordinator does on every first contact: the participant's own words, the
 * criterion observations with their source text, an explicit list of what is
 * missing, and a reply that a person writes or edits before it is sent.
 *
 * A pre-filled draft is offered for logistical questions because site policy
 * answers repeat across participants. It is never sent automatically.
 */
export default async function CoordinatorInquiryPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = getInquiry(id);
  if (!inquiry) notFound();

  const grant = inquiry.grantId ? getGrant(inquiry.grantId) : null;
  // The grant is the authorization. Without an active one there is nothing to show.
  if (!isGrantActive(grant)) {
    return (
      <div className="space-y-4">
        <Link href="/coordinator" className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">← Inbox</Link>
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-ink">This inquiry is no longer available</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            The participant revoked access, or the sharing grant expired. Nothing further can be
            read here. If you already recorded details elsewhere, your institution&rsquo;s own
            retention rules apply to that copy — revoking access in this app cannot recall it.
          </p>
        </Card>
      </div>
    );
  }

  const participant = getParticipant(inquiry.participantId);
  const trial = getTrial(inquiry.trialId);
  if (!participant || !trial) notFound();

  const assessment = assessTrial(trial, participant);
  const questions = listQuestions({ inquiryId: inquiry.id });
  const shared = inquiry.sharedFields as Record<string, unknown>;

  const conflicts = assessment.assessments.filter((a) => a.status === "conflict");
  const unknowns = assessment.assessments.filter((a) => a.status === "unknown");
  const reviews = assessment.assessments.filter((a) => a.status === "needs_clinical_review");

  const canned = trial.isFictional ? cannedAnswersFor(trial.id) : [];

  return (
    <div className="space-y-5">
      <Link href="/coordinator" className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">← Inbox</Link>

      {trial.isFictional ? <FictionBanner /> : null}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {participant.displayName}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{trial.briefTitle ?? trial.id}</p>
        <p className="mt-1 text-xs text-ink-faint">
          Shared {new Date(inquiry.createdAt).toLocaleString()} · state:{" "}
          {inquiry.state.replace(/_/g, " ")} · authorised fields:{" "}
          {grant!.allowedFields.join(", ")}
        </p>
      </header>

      <Note tone="caution">
        Everything below is self-reported by the participant and has not been verified against
        medical records. It is preparation for a conversation, not a screening decision. Confirm
        eligibility through your own process.
      </Note>

      {/* ------------------------------------------------- what they shared */}
      <section>
        <SectionHeading hint="Only the fields this person chose to share are present.">
          Participant-authorised information
        </SectionHeading>
        <Card className="p-4">
          <dl className="space-y-2">
            {Object.entries(shared).map(([key, value]) => (
              <div key={key} className="grid gap-0.5 border-b border-rule pb-2 last:border-0 sm:grid-cols-[10rem_1fr]">
                <dt className="text-xs uppercase tracking-wide text-ink-faint">{humanize(key)}</dt>
                <dd className="text-sm text-ink">{renderValue(value)}</dd>
              </div>
            ))}
          </dl>
          {!grant!.allowedFields.includes("contact") ? (
            <p className="mt-3 rounded-lg bg-paper-sunken px-3 py-2 text-xs leading-relaxed text-ink-soft">
              This person did not share contact details. Reply through this inquiry and they will
              see it in their passport.
            </p>
          ) : null}
        </Card>
      </section>

      {/* -------------------------------------------- their own words */}
      <section>
        <SectionHeading>Their message</SectionHeading>
        <Card className="p-4">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-ink-soft">
            {inquiry.message}
          </pre>
        </Card>
      </section>

      {/* ---------------------------------------------- pre-screen summary */}
      <section>
        <SectionHeading hint="Generated by rule, with the source wording attached to each observation. Verify against the protocol before relying on any of it.">
          Provisional criterion observations
        </SectionHeading>

        <div className="mb-2.5 flex flex-wrap gap-2 text-xs text-ink-soft">
          <span>{assessment.supported} matched</span>
          <span>· {conflicts.length} possible conflict{conflicts.length === 1 ? "" : "s"}</span>
          <span>· {unknowns.length} unanswered</span>
          <span>· {reviews.length} needing review</span>
        </div>

        {[
          { title: "Possible conflicts", items: conflicts },
          { title: "Needs your review", items: reviews },
          { title: "Unanswered", items: unknowns.slice(0, 8) },
        ].map((group) =>
          group.items.length ? (
            <Card key={group.title} className="mb-2.5 p-4">
              <h3 className="mb-2 text-sm font-semibold text-ink">
                {group.title} ({group.items.length})
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => (
                  <li key={item.criterionId} className="rounded-lg border border-rule p-2.5">
                    <div className="mb-1"><StatusChip status={item.status} /></div>
                    <p className="text-sm leading-relaxed text-ink-soft">{item.rationale}</p>
                    <blockquote className="source-quote mt-1.5">{item.evidenceSpan}</blockquote>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {trial.id} eligibility criteria
                      {item.sourceStart >= 0 ? `, characters ${item.sourceStart}–${item.sourceEnd}` : ""} · record version{" "}
                      {trial.lastUpdatePostDate ?? "unknown"}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null
        )}

        {assessment.missingInformation.length ? (
          <Card className="p-4">
            <h3 className="mb-1.5 text-sm font-semibold text-ink">Missing information to request</h3>
            <ul className="space-y-1">
              {assessment.missingInformation.map((missing) => (
                <li key={missing.key} className="text-sm text-ink-soft">
                  · {missing.label} — would resolve {missing.affectedCriteria} requirement
                  {missing.affectedCriteria === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </section>

      {/* ----------------------------------------------------- their questions */}
      <section>
        <SectionHeading hint="Each answer is written or edited by you before it is sent. Nothing is sent automatically.">
          Questions to answer ({questions.filter((q) => !q.answer).length} open)
        </SectionHeading>

        <ul className="space-y-3">
          {questions.map((question) => {
            const suggestion = canned.find((entry) =>
              entry.matches.some((keyword) => question.text.toLowerCase().includes(keyword))
            );
            return (
              <Card as="li" key={question.id} className="p-4">
                <p className="text-sm font-medium text-ink">{question.text}</p>
                <p className="mt-0.5 text-xs text-ink-faint">
                  {question.category}
                  {question.category === "clinical"
                    ? " — route to an investigator or qualified staff member"
                    : ""}
                  {" · "}
                  {question.state.replace(/_/g, " ")}
                </p>

                {question.answer ? (
                  <div className="mt-2.5 rounded-lg border border-teal/30 bg-teal-soft p-3">
                    <p className="text-sm leading-relaxed text-teal-deep">{question.answer}</p>
                    <p className="mt-1.5 text-[11px] text-teal-deep/70">
                      Sent by {question.answeredBy}
                      {question.answerCitation ? ` · ${question.answerCitation}` : ""}
                    </p>
                  </div>
                ) : (
                  <form action={coordinatorAnswerAction} className="mt-2.5 space-y-2">
                    <input type="hidden" name="questionId" value={question.id} />
                    <input type="hidden" name="inquiryId" value={inquiry.id} />
                    {suggestion ? (
                      <p className="rounded-lg bg-paper-sunken px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-soft">
                        A site-policy answer has been pre-filled from your saved replies. Edit it
                        before sending — you are the author.
                      </p>
                    ) : null}
                    <label className="sr-only" htmlFor={`answer-${question.id}`}>Your answer</label>
                    <textarea
                      id={`answer-${question.id}`} name="answer" rows={4} required
                      defaultValue={suggestion?.answer ?? ""}
                      placeholder="Write the answer you want this person to receive."
                      className="w-full rounded-lg border border-rule bg-paper-raised p-3 text-sm text-ink"
                    />
                    <label className="block text-xs text-ink-soft">
                      Where this comes from (shown to the participant)
                      <input
                        name="citation" defaultValue={suggestion?.citation ?? ""}
                        placeholder="e.g. Protocol v2.1 section 6, or site policy confirmed today"
                        className="mt-1 min-h-11 w-full rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink"
                      />
                    </label>
                    <button
                      type="submit"
                      className="min-h-11 rounded-lg border border-teal bg-teal px-4 text-sm font-medium text-white hover:bg-teal-deep"
                    >
                      Send this answer
                    </button>
                  </form>
                )}
              </Card>
            );
          })}
          {questions.length === 0 ? (
            <Card as="li" className="p-4 text-sm text-ink-soft">
              This person did not attach any questions.
            </Card>
          ) : null}
        </ul>
      </section>

      <section>
        <SectionHeading>Move this along</SectionHeading>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={coordinatorAcknowledgeAction} className="flex-1">
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
            >
              Acknowledge receipt
            </button>
          </form>
        </div>
        <form action={coordinatorRequestInfoAction} className="mt-2.5 space-y-2">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <label className="block text-xs text-ink-soft">
            Ask for something specific
            <input
              name="note"
              placeholder="e.g. We would need your HER2 result before screening — your oncology team can send it."
              className="mt-1 min-h-11 w-full rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
          >
            Request information
          </button>
        </form>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Acknowledging an inquiry is not enrolment and is not a screening decision. The
          participant sees exactly these state changes.
        </p>
      </section>
    </div>
  );
}

interface CannedAnswer { matches: string[]; answer: string; citation: string }

/** Saved site-policy replies, from the fictional fixture. A real deployment
 *  would hold a site's own approved reply library here. */
function cannedAnswersFor(trialId: string): CannedAnswer[] {
  if (trialId !== "TP-FIX-001") return [];
  return getFictionalFixture()?.cannedAnswers ?? [];
}

function humanize(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function renderValue(value: unknown): string {
  if (value == null || value === "") return "not shared";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object" && "label" in item
          ? `${(item as { label: string }).label}: ${(item as { value: string | null }).value ?? "unknown"}`
          : String(item)
      )
      .join("; ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => `${key}: ${entry ?? "not shared"}`)
      .join("; ");
  }
  return String(value);
}
