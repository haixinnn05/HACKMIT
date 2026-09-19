import { notFound } from "next/navigation";
import {
  CalendarBlank, Car, CaretRight, Clock, CreditCard, Plus, Question, UsersThree, UsersFour,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Callout, Card, FictionBanner, ProvenanceTag, ScreenHeader, SectionHeading } from "@/components/ui";
import { computeBurden } from "@/lib/burden";
import { assessPracticalFit } from "@/lib/assess";
import { getTrial, listQuestions } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { addQuestionAction } from "@/app/actions";
import type { Provenance } from "@/lib/types";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

interface Row {
  icon: ReactNode; label: string; value: string; note: string;
  provenance: Provenance; detail: string;
}

/**
 * Participation Preview: what taking part would ask of an ordinary week.
 *
 * Every row says where its value came from. A study that publishes no schedule
 * shows "Not published" rather than a figure inferred from its length, because
 * a guessed visit count would be an invented commitment.
 */
export default async function PreviewPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ visits?: string; travel?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const trial = getTrial(decodeURIComponent(id));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const fit = assessPracticalFit(trial, participant);
  const burden = computeBurden(trial, participant, {
    oneWayTravelMinutes: participant.oneWayTravelMinutes,
    visitCountOverride: query.visits ? Number(query.visits) : null,
    travelOverrideMinutes: query.travel ? Number(query.travel) : null,
  });
  const existing = listQuestions({ participantId: participant.id, trialId: trial.id }).map((q) => q.text);

  const schedule = trial.visitSchedule;
  const logistics = trial.knownLogistics;
  const miles = fit.nearestSiteKm != null ? Math.round(fit.nearestSiteKm / KM_PER_MILE) : null;
  const hours = schedule?.visits.map((visit) => visit.onSiteHours) ?? [];
  const unpublished = "This study's registry record does not state this. Ask the study team.";

  const rows: Row[] = [
    {
      icon: <CalendarBlank size={22} />, label: "Study duration",
      value: burden.weeksSpanned != null ? `About ${burden.weeksSpanned} weeks` : "Not published",
      note: burden.weeksSpanned != null ? "first visit to last visit" : "not inferred from the study's dates",
      provenance: schedule ? schedule.provenance : "unknown",
      detail: schedule ? (schedule.notes ?? "") : unpublished,
    },
    {
      icon: <UsersThree size={22} />, label: "Study visits",
      value: schedule ? `${schedule.visits.length} on-site visits` : "Not published",
      note: schedule?.remoteContacts.length ? `plus ${schedule.remoteContacts.length} remote contact` : schedule ? "no remote contacts listed" : "visit count is never guessed",
      provenance: schedule ? schedule.provenance : "unknown",
      detail: schedule ? schedule.visits.map((visit) => `${visit.name}: ${visit.procedures.join(", ")}`).join(". ") : unpublished,
    },
    {
      icon: <Clock size={22} />, label: "Time per visit",
      value: hours.length ? (Math.min(...hours) === Math.max(...hours) ? `${hours[0]} hours` : `${Math.min(...hours)} to ${Math.max(...hours)} hours`) : "Not published",
      note: hours.length ? "scheduled clinic time, not waiting time" : "varies by study",
      provenance: schedule ? schedule.provenance : "unknown",
      detail: schedule ? "Waiting time and procedures added on the day are not included." : unpublished,
    },
    {
      icon: <Car size={22} />, label: "Travel distance",
      value: miles != null ? `About ${miles} miles` : "Not known",
      note: fit.nearestSite?.city ? `${fit.nearestSite.city}${fit.nearestSite.state ? `, ${fit.nearestSite.state}` : ""}, straight-line` : "no site coordinates in the record",
      provenance: miles != null ? "registry" : "unknown",
      detail: participant.oneWayTravelMinutes != null
        ? `You entered about ${participant.oneWayTravelMinutes} minutes each way. The distance shown is straight-line from the registry's site coordinates, not a drive time.`
        : "Add your own travel time in your profile to include travel in the total.",
    },
    {
      icon: <CreditCard size={22} />, label: "Possible reimbursement",
      value: logistics?.compensationStated ? "Payment per visit is stated" : logistics ? "Not stated" : "Not published",
      note: logistics && !logistics.travelReimbursementStated ? "travel costs: check with the study site" : "check with the study site",
      provenance: logistics?.compensationStated ? (schedule?.provenance ?? "unknown") : "unknown",
      detail: logistics?.compensationText ?? "Only a study's own reviewed payment terms are ever shown here. Nothing is estimated.",
    },
    {
      icon: <UsersFour size={22} />, label: "Caregiver / support",
      value: logistics?.caregiverAccommodationStated ? "Stated by the site" : "Not stated",
      note: participant.caregiverAvailable ? "you said someone can come with you" : "you have not said whether someone can come",
      provenance: logistics?.caregiverAccommodationStated ? (schedule?.provenance ?? "unknown") : "unknown",
      detail: "Whether someone can attend with you, and where they can wait, is a question for the coordinator.",
    },
  ];

  const suggested = burden.openQuestions.filter((question) => !existing.includes(question));

  return (
    <div className="space-y-4">
      <ScreenHeader
        back={`/trial/${trial.id}?tab=expect`}
        title="Participation Preview"
        sub="Here’s what taking part may look like. Details vary by site, and your care team can help you weigh them."
      />

      {trial.isFictional ? <FictionBanner>The schedule below is invented so the full preview can be shown. Real registry records rarely publish one.</FictionBanner> : null}

      {burden.available ? (
        <Card className="px-4 py-3">
          {burden.hypothetical ? (
            <p className="mb-2 rounded-[12px] bg-peach-soft px-3 py-2 text-[12px] font-semibold leading-relaxed text-peach">
              A what-if you typed in. The study has not agreed to it.
            </p>
          ) : null}
          <p className="flex items-baseline gap-2">
            <span className="text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-ink">{burden.totalHours}</span>
            <span className="text-[13px] text-ink-soft">hours in total{burden.partial ? ", travel not included" : ""}</span>
          </p>
          <details>
            <summary className="flex min-h-11 cursor-pointer items-center text-[12px] font-bold text-iris">How we worked this out</summary>
            <p className="font-mono text-[11.5px] leading-relaxed text-ink-faint">{burden.formula}</p>
            <p className="mt-1.5 pb-1 text-[11.5px] leading-relaxed text-ink-faint">Not included: {burden.exclusions.join(", ").toLowerCase()}.</p>
          </details>
        </Card>
      ) : (
        <Callout tone="caution" title="No total can be shown">{burden.unavailableReason}</Callout>
      )}

      <ul className="space-y-2">
        {rows.map((row) => (
          <Card as="li" key={row.label}>
            <details className="group">
              <summary className="press flex min-h-14 cursor-pointer list-none items-center gap-3.5 px-4 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris">{row.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-ink">{row.label}</span>
                  <span className={`block text-[13px] ${row.provenance === "unknown" ? "italic text-ink-faint" : "text-ink-soft"}`}>{row.value}</span>
                  <span className="block text-[11.5px] text-ink-faint">({row.note})</span>
                </span>
                <CaretRight size={16} weight="bold" className="shrink-0 text-ink-faint transition-transform group-open:rotate-90" />
              </summary>
              <div className="space-y-2 px-4 pb-4 pl-[4.4rem]">
                <ProvenanceTag provenance={row.provenance} />
                <p className="text-[12.5px] leading-relaxed text-ink-soft">{row.detail}</p>
              </div>
            </details>
          </Card>
        ))}
      </ul>

      {burden.available ? (
        <form action={`/trial/${trial.id}/preview`} className="rounded-[20px] border border-rule bg-surface p-4">
          <p className="text-[13.5px] font-bold text-ink">What if it were different?</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">See what you would be asking for. Nothing here is agreed by the study.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2.5">
            <label className="text-[11.5px] font-semibold text-ink-soft">
              On-site visits
              <input type="number" name="visits" min={1} max={40} defaultValue={query.visits ?? burden.visitCount ?? 4}
                className="mt-1 block min-h-11 w-24 rounded-[14px] border border-rule bg-surface px-3 text-[14px] text-ink" />
            </label>
            <label className="text-[11.5px] font-semibold text-ink-soft">
              Travel each way (min)
              <input type="number" name="travel" min={0} max={600} defaultValue={query.travel ?? participant.oneWayTravelMinutes ?? 45}
                className="mt-1 block min-h-11 w-28 rounded-[14px] border border-rule bg-surface px-3 text-[14px] text-ink" />
            </label>
            <button type="submit" className="press min-h-11 rounded-full border border-rule-strong bg-surface px-4 text-[13px] font-bold text-ink hover:bg-sunken">Recalculate</button>
          </div>
        </form>
      ) : null}

      <div className="flex items-start gap-3 rounded-[20px] bg-lavender px-4 py-4">
        <Question size={24} weight="fill" className="mt-0.5 shrink-0 text-iris" />
        <div>
          <p className="text-[14px] font-bold text-ink">Still unknown?</p>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Some details, like certain tests or long-term follow-up, may vary. Bring your questions to the study team.
          </p>
        </div>
      </div>

      {suggested.length ? (
        <section>
          <SectionHeading hint="Tap to add one to your saved questions.">Worth asking</SectionHeading>
          <div className="flex flex-col gap-2">
            {suggested.map((question) => (
              <form key={question} action={addQuestionAction}>
                <input type="hidden" name="trialId" value={trial.id} />
                <input type="hidden" name="text" value={question} />
                <input type="hidden" name="returnTo" value={`/trial/${trial.id}/preview`} />
                <button type="submit" className="press flex min-h-12 w-full items-center gap-2.5 rounded-[14px] border border-rule bg-surface px-3.5 py-2.5 text-left text-[13px] text-ink hover:border-iris">
                  <Plus size={16} weight="bold" className="shrink-0 text-iris" /> {question}
                </button>
              </form>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
