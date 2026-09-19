import Link from "next/link";
import { CaretRight, Heart } from "@phosphor-icons/react/dist/ssr";
import { Card, Empty, Pill, ScreenHeader, SectionHeading } from "@/components/ui";
import { getTrial, listEnrollments, listSavedTrialIds } from "@/lib/repo";
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
      <ScreenHeader back="/profile" title="Past / Saved Trials" sub="Studies you saved, and what you decided about each." />

      <section>
        <SectionHeading>Saved ({saved.length})</SectionHeading>
        {saved.length === 0 ? (
          <Empty title="Nothing saved yet" icon={<Heart size={22} />}>Tap the heart on a study to keep it here.</Empty>
        ) : (
          <ul className="space-y-2.5">
            {saved.map((trial) => (
              <Card as="li" key={trial!.id}>
                <Link href={`/trial/${trial!.id}`} className="press flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13.5px] font-bold leading-snug text-ink">{trial!.briefTitle ?? trial!.id}</span>
                    <span className="block font-mono text-[11px] text-ink-faint">{trial!.id}</span>
                  </span>
                  <CaretRight size={16} weight="bold" className="text-iris" />
                </Link>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {decisions.length ? (
        <section>
          <SectionHeading hint="Deciding against a study is a good outcome too. You can change any of these.">My decisions</SectionHeading>
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
