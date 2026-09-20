import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Archive, CaretLeft, CaretRight, ChatCircleDots, EnvelopeSimpleOpen, PaperPlaneTilt, SealCheck,
} from "@phosphor-icons/react/dist/ssr";
import { Hills } from "@/components/Brand";
import { PrintButton } from "@/components/CountedTextarea";
import { Callout, Card, LinkButton, Pill, SectionHeading } from "@/components/ui";
import { getGrant, getInquiry, getParticipatingEnrollment, getTrial, listQuestions, markInquirySeen } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { decideAction, questionFollowUpAction } from "@/app/actions";
import { isAnswered, QUESTION_STATE_LABEL } from "@/lib/questions";
import type { InquiryState } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATE_FACE: Record<InquiryState, {
  copy: string;
  icon: typeof PaperPlaneTilt;
  iconClass: string;
  disc: string;
}> = {
  draft: {
    copy: "Not shared yet",
    icon: PaperPlaneTilt,
    iconClass: "text-ink-soft",
    disc: "bg-sunken",
  },
  shared: {
    copy: "Shared, waiting to be picked up",
    icon: PaperPlaneTilt,
    iconClass: "text-iris",
    disc: "bg-iris-soft",
  },
  acknowledged: {
    copy: "Someone on the team has it",
    icon: EnvelopeSimpleOpen,
    iconClass: "text-iris-deep",
    disc: "bg-iris-soft",
  },
  needs_information: {
    copy: "The team has asked for something",
    icon: ChatCircleDots,
    iconClass: "text-peach",
    disc: "bg-peach-soft",
  },
  answered: {
    copy: "You have a reply",
    icon: SealCheck,
    iconClass: "text-mint",
    disc: "bg-mint-soft",
  },
  approved: {
    copy: "The study team approved this",
    icon: SealCheck,
    iconClass: "text-mint",
    disc: "bg-mint-soft",
  },
  closed: {
    copy: "Closed",
    icon: Archive,
    iconClass: "text-ink-soft",
    disc: "bg-sunken",
  },
};

/** One conversation with a study team: who owns it, and what state it is in. */
export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiry = getInquiry(id);
  const participant = await getActiveParticipant();
  // Authorization: only the person who created an inquiry can read it.
  if (!inquiry || inquiry.participantId !== participant.id) notFound();

  markInquirySeen(inquiry.id);

  const trial = getTrial(inquiry.trialId);
  const grant = inquiry.grantId ? getGrant(inquiry.grantId) : null;
  const questions = listQuestions({ inquiryId: inquiry.id });
  const face = STATE_FACE[inquiry.state] ?? STATE_FACE.shared;
  const StatusIcon = face.icon;
  const answered = questions.filter((q) => isAnswered(q));
  const open = questions.filter((q) => !isAnswered(q));
  const underway = getParticipatingEnrollment(participant.id);
  const otherStudy = Boolean(underway && underway.trialId !== inquiry.trialId);

  const choices = [
    { value: "help", label: "Please help me contact the study team" },
    { value: "declined", label: "I am not interested" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <header className="relative -mx-5 -mt-5 overflow-hidden bg-lavender px-5 pb-9 pt-3">
          <Hills />
          <div className="relative flex min-h-11 items-center justify-between">
            <Link href="/inbox" className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
              <CaretLeft size={20} weight="bold" />
              <span className="sr-only">Back</span>
            </Link>
            <PrintButton />
          </div>
        </header>

        <div className="relative z-10 -mt-8 flex items-center gap-3 rounded-[20px] border border-rule bg-surface px-3.5 py-3 shadow-[0_2px_10px_rgba(14,13,99,0.06)]">
          <span className={`grid size-11 shrink-0 place-items-center rounded-full ${face.disc}`}>
            <StatusIcon size={20} weight="fill" className={face.iconClass} />
          </span>
          <h1 className={`min-w-0 text-[15px] font-bold leading-snug tracking-[-0.01em] ${face.iconClass}`}>{face.copy}</h1>
        </div>
      </div>

      <Card className="p-4">
        <p className="text-[14px] font-bold leading-snug text-ink">{trial?.briefTitle ?? inquiry.trialId}</p>
        <p className="mt-1 text-[12px] text-ink-soft">
          Shared with {grant?.recipientLabel ?? "the study team"} on {new Date(inquiry.createdAt).toLocaleDateString()}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-faint">
          Shared: {grant?.allowedFields.join(", ") || "nothing"}
          {grant?.state === "revoked" ? <Pill tone="blush">Access revoked</Pill> : null}
        </p>
      </Card>

      {inquiry.coordinatorNote ? (
        <Callout title="Note from the team">{inquiry.coordinatorNote}</Callout>
      ) : null}

      {answered.length ? (
        <section>
          <SectionHeading>Answers</SectionHeading>
          <ul className="space-y-2.5">
            {answered.map((question) => (
              <Card as="li" key={question.id} className="p-4">
                <p className="text-[13.5px] font-bold text-ink">{question.text}</p>
                <p className="mt-2 rounded-[14px] bg-mint-soft p-3 text-[13px] leading-relaxed text-ink">{question.answer}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  {question.answeredBy}{question.answerCitation ? `. ${question.answerCitation}` : ""}
                </p>
                {question.state === "resolved" ? (
                  <p className="mt-2"><Pill tone="mint">You marked this resolved</Pill></p>
                ) : (
                  <form action={questionFollowUpAction} className="no-print mt-2.5 flex gap-2">
                    <input type="hidden" name="questionId" value={question.id} />
                    <button type="submit" name="intent" value="resolve" className="press min-h-11 flex-1 rounded-full border border-rule-strong bg-surface text-[12.5px] font-bold text-ink hover:bg-sunken">This answers it</button>
                    <button type="submit" name="intent" value="reopen" className="press min-h-11 flex-1 rounded-full border border-rule-strong bg-surface text-[12.5px] font-bold text-ink hover:bg-sunken">I still have a question</button>
                  </form>
                )}
              </Card>
            ))}
          </ul>
        </section>
      ) : null}

      {open.length ? (
        <section>
          <SectionHeading>Still open</SectionHeading>
          <Card className="px-4">
            <ul>
              {open.map((question) => (
                <li key={question.id} className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0">
                  <span className="text-[13px] text-ink">{question.text}</span>
                  <Pill>{question.answer ? "Reopened" : question.state === "draft_answer" ? "Being answered" : QUESTION_STATE_LABEL[question.state]}</Pill>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <details className="rounded-[16px] border border-rule bg-surface px-4">
        <summary className="flex min-h-12 cursor-pointer items-center text-[13px] font-bold text-iris">What you sent</summary>
        <pre className="mb-4 whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink-soft">{inquiry.message}</pre>
      </details>

      {inquiry.state === "closed" ? (
        otherStudy ? (
          <LinkButton href="/" className="w-full">Open your path</LinkButton>
        ) : (
          <LinkButton href={`/apply/${inquiry.trialId}`} className="w-full">Apply</LinkButton>
        )
      ) : (
        <section className="no-print">
          <SectionHeading>Where you stand</SectionHeading>
          {otherStudy ? (
            <p className="mb-2.5 text-[12.5px] leading-snug text-ink-soft">You can take part in one study at a time.</p>
          ) : null}
          <Card className="overflow-hidden">
            {choices.map((choice) => (
              <form key={choice.value} action={decideAction} className="border-b border-rule last:border-0">
                <input type="hidden" name="trialId" value={inquiry.trialId} />
                <input type="hidden" name="inquiryId" value={inquiry.id} />
                <input type="hidden" name="decision" value={choice.value} />
                <button type="submit" className="press flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken">
                  <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-ink">{choice.label}</span>
                  </span>
                  <CaretRight size={16} weight="bold" className="text-iris" />
                </button>
              </form>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
