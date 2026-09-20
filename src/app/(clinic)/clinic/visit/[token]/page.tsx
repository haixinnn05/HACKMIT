import Link from "next/link";
import { CaretRight, Check } from "@phosphor-icons/react/dist/ssr";
import { Card, Pill, ScreenHeader } from "@/components/ui";
import { requestNow } from "@/lib/clock";
import { getGrantByToken, getParticipant, getParticipatingEnrollment, getTrial, listVisitForms } from "@/lib/repo";
import { currentStudyVisit, isPackOnFile, requiredPacks, suggestedPack, VISIT_PACKS } from "@/lib/visit-forms";

export const dynamic = "force-dynamic";

/**
 * After a scan: pick the packet for this in-person visit. The passport already
 * opened the grant; these forms fill from it.
 */
export default async function VisitPacketsPage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { token } = await params;
  const { saved: justSaved } = await searchParams;
  const grant = getGrantByToken(token);
  if (!grant) {
    return (
      <div className="space-y-4">
        <ScreenHeader back="/clinic/scan" title="Visit forms" />
        <Card className="p-5 text-[13.5px] leading-relaxed text-ink-soft">This code is not active.</Card>
      </div>
    );
  }

  const participant = getParticipant(grant.participantId);
  const name = participant?.displayName.replace(/\s*\(synthetic\)$/, "") ?? "Patient";
  const enrollment = getParticipatingEnrollment(grant.participantId);
  const trial = enrollment ? getTrial(enrollment.trialId) : null;
  const today = new Date(requestNow()).toISOString().slice(0, 10);
  const todaysVisit = currentStudyVisit(enrollment?.visits, today);
  const onFile = listVisitForms(grant.participantId);
  const needed = new Set(requiredPacks(todaysVisit?.name ?? null, onFile));
  const suggest = suggestedPack(todaysVisit?.name ?? null);

  return (
    <div className="space-y-4">
      <ScreenHeader back={`/handoff/${token}?from=clinic`} title="Visit forms" sub={name} />

      {todaysVisit ? (
        <p className="text-[13px] leading-relaxed text-ink-soft">
          {todaysVisit.name}{trial?.briefTitle ? ` · ${trial.briefTitle}` : ""}
        </p>
      ) : null}

      {justSaved ? <p className="text-[13px] font-semibold text-mint">Saved.</p> : null}

      <ul className="space-y-2">
        {VISIT_PACKS.map((pack) => (
          <li key={pack.id}>
            <Link href={`/clinic/visit/${token}/${pack.id}`} className="press flex items-center gap-3 rounded-[20px] border border-rule bg-surface px-4 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-bold text-ink">{pack.title}</span>
                  {pack.id === suggest ? <Pill tone="iris">For this visit</Pill> : null}
                  {needed.has(pack.id) && !isPackOnFile(pack.id, todaysVisit?.name ?? null, onFile) ? <Pill tone="peach">Required</Pill> : null}
                  {isPackOnFile(pack.id, todaysVisit?.name ?? null, onFile) ? <Pill tone="mint" icon={<Check size={12} weight="bold" />}>On file</Pill> : null}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-soft">{pack.sub}</span>
              </span>
              <CaretRight size={16} weight="bold" className="shrink-0 text-ink-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
