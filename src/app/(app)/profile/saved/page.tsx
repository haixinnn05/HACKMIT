import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Card, Empty, Pill, ScreenHeader, SectionHeading } from "@/components/ui";
import { getInquiryForTrial, getTrial, listEnrollments, listSavedTrialIds } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";

export const dynamic = "force-dynamic";

const DECISION = {
  participating: { label: "Taking part", tone: "mint" as const },
  considering: { label: "Thinking it over", tone: "iris" as const },
  declined: { label: "Decided against", tone: "neutral" as const },
};

export default async function SavedTrialsPage() {
  const participant = await getActiveParticipant();
  const saved = listSavedTrialIds(participant.id).map(getTrial).filter(Boolean);
  const decisions = listEnrollments(participant.id);

  return (
    <div className="space-y-5">
      <ScreenHeader back="/profile" title="Past / Saved Trials" />

      <section>
        <SectionHeading>Saved ({saved.length})</SectionHeading>
        {saved.length === 0 ? (
          <Empty title="Nothing saved yet" />
        ) : (
          <ul className="space-y-2.5">
            {saved.map((trial) => {
              const enrollment = decisions.find((entry) => entry.trialId === trial!.id);
              const inquiry = getInquiryForTrial(participant.id, trial!.id);
              const pill = enrollment
                ? DECISION[enrollment.status]
                : inquiry
                  ? { label: inquiry.state === "closed" ? "Closed" : "Inquiry sent", tone: "iris" as const }
                  : null;
              return (
              <Card as="li" key={trial!.id}>
                <Link href={`/trial/${trial!.id}`} className="press flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13.5px] font-bold leading-snug text-ink">{trial!.briefTitle ?? trial!.id}</span>
                    <span className="block font-mono text-[11px] text-ink-faint">{trial!.id}</span>
                  </span>
                  {pill ? <Pill tone={pill.tone}>{pill.label}</Pill> : null}
                  <CaretRight size={16} weight="bold" className="text-iris" />
                </Link>
              </Card>
              );
            })}
          </ul>
        )}
      </section>

      {decisions.length ? (
        <section>
          <SectionHeading>My decisions</SectionHeading>
          <ul className="space-y-2.5">
            {decisions.map((entry) => (
              <Card as="li" key={entry.id}>
                <Link href={`/trial/${entry.trialId}`} className="press flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1 text-[13.5px] font-bold leading-snug text-ink">{getTrial(entry.trialId)?.briefTitle ?? entry.trialId}</span>
                  <Pill tone={DECISION[entry.status].tone}>{DECISION[entry.status].label}</Pill>
                </Link>
              </Card>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
