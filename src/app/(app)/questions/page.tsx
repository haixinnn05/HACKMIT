import { CaretRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { Card, Empty, Pill, ScreenHeader, Tabs } from "@/components/ui";
import { getTrial, listQuestions, listSavedTrialIds } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { addQuestionAction, removeQuestionAction } from "@/app/actions";
import { isAnswered } from "@/lib/questions";
import type { Question } from "@/lib/types";

export const dynamic = "force-dynamic";

function statusOf(question: Question) {
  if (isAnswered(question)) return { id: "answered", label: question.state === "resolved" ? "Resolved" : "Answered", tone: "mint" as const };
  if (question.answer) return { id: "sent", label: "Reopened", tone: "peach" as const };
  if (question.inquiryId) return { id: "sent", label: "Sent", tone: "neutral" as const };
  return { id: "ask", label: "Need to ask", tone: "iris" as const };
}

/**
 * Saved Questions: the persistent queue.
 *
 * A question stays here until a person at a study site answers it. Clinical
 * questions are labelled as going to qualified staff; this app never answers
 * them itself.
 */
export default async function QuestionsPage({
  searchParams,
}: { searchParams: Promise<{ tab?: string; trial?: string; add?: string }> }) {
  const params = await searchParams;
  const participant = await getActiveParticipant();
  const all = listQuestions({ participantId: participant.id })
    .filter((question) => !params.trial || question.trialId === params.trial);

  const needAsk = all.filter((q) => statusOf(q).id === "ask");
  const answered = all.filter((q) => statusOf(q).id === "answered");
  const tab = params.tab === "ask" || params.tab === "answered" ? params.tab : "all";
  const shown = tab === "ask" ? needAsk : tab === "answered" ? answered : all;

  const trialIds = [...new Set([params.trial, ...listSavedTrialIds(participant.id), ...all.map((q) => q.trialId)].filter(Boolean))] as string[];
  const scope = params.trial ? `&trial=${params.trial}` : "";
  const href = (id: string) => `/questions?tab=${id}${scope}`;
  const adding = params.add === "1";

  return (
    <div className="space-y-4">
      <ScreenHeader
        back={params.trial ? `/trial/${params.trial}?tab=expect` : "/profile"}
        title="Saved Questions"
        action={
          <a href={`/questions?add=1${scope}`} className="press inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[14px] font-bold text-iris hover:bg-iris-soft">
            <Plus size={16} weight="bold" /> Add
          </a>
        }
      />

      {adding ? (
        <Card className="animate-rise p-4">
          <form action={addQuestionAction} className="space-y-3">
            <input type="hidden" name="returnTo" value={`/questions${params.trial ? `?trial=${params.trial}` : ""}`} />
            <label className="block text-[12px] font-semibold text-ink-soft">
              Your question
              <textarea name="text" required rows={2} autoFocus placeholder="e.g. Is parking covered at the study site?"
                className="mt-1 w-full rounded-[14px] border border-rule bg-surface px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint" />
            </label>
            <label className="block text-[12px] font-semibold text-ink-soft">
              About which study
              <select name="trialId" defaultValue={params.trial ?? trialIds[0] ?? "general"}
                className="mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3 text-[13.5px] text-ink">
                {trialIds.map((id) => (
                  <option key={id} value={id}>{(getTrial(id)?.briefTitle ?? id).slice(0, 60)}</option>
                ))}
                <option value="general">Not about a specific study</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="submit" className="press cta min-h-12 flex-1 rounded-full text-[14px] font-bold text-white">Save question</button>
              <a href={`/questions${params.trial ? `?trial=${params.trial}` : ""}`} className="press inline-flex min-h-12 items-center rounded-full border border-rule-strong px-5 text-[14px] font-bold text-ink">Cancel</a>
            </div>
          </form>
        </Card>
      ) : null}

      <Tabs
        current={tab}
        tabs={[
          { id: "all", label: `All (${all.length})`, href: href("all") },
          { id: "ask", label: `Need to ask (${needAsk.length})`, href: href("ask") },
          { id: "answered", label: `Answered (${answered.length})`, href: href("answered") },
        ]}
      />

      {shown.length === 0 ? (
        <Empty title={tab === "answered" ? "No answers yet" : "No questions here"} />
      ) : (
        <ul className="space-y-2.5">
          {shown.map((question) => {
            const status = statusOf(question);
            const trial = getTrial(question.trialId);
            return (
              <Card as="li" key={question.id}>
                <details className="group">
                  <summary className="press flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-ink">{question.text}</span>
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <CaretRight size={15} weight="bold" className="shrink-0 text-ink-faint transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="space-y-2 px-4 pb-4">
                    <p className="text-[11.5px] text-ink-faint">
                      {trial?.briefTitle ?? "Not about a specific study"}
                      {question.category === "clinical" ? ". Clinical question: goes to qualified study staff." : ""}
                    </p>
                    {question.answer ? (
                      <div className="rounded-[14px] bg-mint-soft p-3">
                        <p className="text-[13px] leading-relaxed text-ink">{question.answer}</p>
                        <p className="mt-1.5 text-[11px] text-ink-soft">
                          {question.answeredBy}{question.answerCitation ? `. ${question.answerCitation}` : ""}
                        </p>
                      </div>
                    ) : question.inquiryId ? (
                      <p className="text-[12.5px] text-ink-soft">Sent with your inquiry. Waiting for the study team.</p>
                    ) : (
                      <form action={removeQuestionAction}>
                        <input type="hidden" name="questionId" value={question.id} />
                        <input type="hidden" name="trialId" value={question.trialId} />
                        <button type="submit" className="min-h-11 text-[12.5px] font-bold text-blush hover:underline">Remove question</button>
                      </form>
                    )}
                  </div>
                </details>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
