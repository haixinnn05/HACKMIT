import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowSquareOut, CaretLeft, CaretRight, Check, Heart, Minus,
} from "@phosphor-icons/react/dist/ssr";
import { OpenAlexResearch, OpenAlexResearchSkeleton } from "@/components/OpenAlexResearch";
import { Hills } from "@/components/Brand";
import {
  Card, DataAge, LinkButton, SectionHeading, StickyAction, Tabs,
} from "@/components/ui";
import { AI_METADATA, answerFromSources, composeOfflineBrief, generateTrialBrief } from "@/lib/ai";
import { assessTrial } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { requestNow } from "@/lib/clock";
import { getInquiryForTrial, getTrial, listEnrollments, listSavedTrialIds, recordMilestone } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { openedFromMap } from "@/lib/map-return";
import { addQuestionAction, toggleSaveAction } from "@/app/actions";
import type { CriterionAssessment, Trial, TrialAssessment } from "@/lib/types";
import type { BurdenPreview } from "@/lib/burden";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

export default async function TrialPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; ask?: string; from?: string; visits?: string; travel?: string }> }) {
  const { id } = await params;
  const { tab: rawTab, ask, from, visits, travel } = await searchParams;
  const tab = rawTab === "eligibility" || rawTab === "expect" ? rawTab : "overview";

  const trial = getTrial(decodeURIComponent(id));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const now = requestNow();
  const assessment = assessTrial(trial, participant);
  const burden = computeBurden(trial, participant, {
    oneWayTravelMinutes: participant.oneWayTravelMinutes,
    visitCountOverride: visits ? Number(visits) : null,
    travelOverrideMinutes: travel ? Number(travel) : null,
  });
  const saved = listSavedTrialIds(participant.id).includes(trial.id);
  const inquiry = getInquiryForTrial(participant.id, trial.id);
  const enrollment = listEnrollments(participant.id).find((entry) => entry.trialId === trial.id);

  // Going past the overview is what "reviewed" means. The stamp is earned once.
  if (tab !== "overview") {
    recordMilestone(participant.id, "reviewed_overview", "Reviewed the study overview", trial.id);
  }

  const site = assessment.practicalFit.nearestSite;
  const miles = assessment.practicalFit.nearestSiteKm != null
    ? Math.round(assessment.practicalFit.nearestSiteKm / KM_PER_MILE) : null;
  const condition = trial.conditions[0];
  const base = `/trial/${trial.id}`;
  const fromMap = openedFromMap(from);
  const tabHref = (tabId?: string) => {
    const query = new URLSearchParams();
    if (tabId) query.set("tab", tabId);
    if (fromMap) query.set("from", "map");
    const suffix = query.toString();
    return suffix ? `${base}?${suffix}` : base;
  };

  const headline =
    assessment.overall === "likely_conflict" ? "Things to review"
      : assessment.overall === "needs_more_information" ? "Questions remain"
      : "Potential option";

  return (
    <div className="space-y-4">
      {/* A thin art band holds the controls; the title sits on white, as on the board. */}
      <div className="relative -mx-5 -mt-5 h-[4.75rem] overflow-hidden bg-lavender px-5 pt-3">
        <Hills />
        <div className="relative flex items-center justify-between">
          <Link href={fromMap ? "/" : "/explore"} suppressHydrationWarning className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <CaretLeft size={20} weight="bold" /><span className="sr-only">{fromMap ? "Back to map" : "Back to trials"}</span>
          </Link>
          <form action={toggleSaveAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <input type="hidden" name="saved" value={String(saved)} />
            <button type="submit" suppressHydrationWarning className="press -mr-2.5 grid size-11 place-items-center rounded-full text-iris hover:bg-ink/5">
              <Heart size={22} weight={saved ? "fill" : "regular"} />
              <span className="sr-only">{saved ? "Remove from saved trials" : "Save this trial"}</span>
            </button>
          </form>
        </div>
      </div>

      <header className="!mt-3">
        <h1 className="text-[1.3rem] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{trial.briefTitle ?? trial.id}</h1>
        <p className="mt-1.5 flex flex-wrap gap-x-2 text-[12.5px] text-ink-soft">
          <span>{trial.phases.length ? trial.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Phase not stated"}</span>
          {condition ? <><span aria-hidden className="text-rule-strong">|</span><span>{condition}</span></> : null}
          <span aria-hidden className="text-rule-strong">|</span>
          <span className="font-mono text-[11.5px]">{trial.id}</span>
        </p>
        <p className="mt-1 text-[12.5px] text-ink-soft">
          {site?.city ? `${site.city}${site.state ? `, ${site.state}` : ""}${miles != null ? ` (about ${miles} miles)` : ""}` : "Location not known"}
        </p>
      </header>

      <p className="text-[13px] font-semibold text-ink">{headline}</p>

      <Tabs
        variant="underline" current={tab}
        tabs={[
          { id: "overview", label: "Overview", href: tabHref() },
          { id: "eligibility", label: "Eligibility", href: tabHref("eligibility") },
          { id: "expect", label: "What to Expect", href: tabHref("expect") },
        ]}
      />

      {tab === "overview" ? <Overview trial={trial} assessment={assessment} nearestCity={site?.city ?? null} now={now} ask={ask?.slice(0, 200) ?? null} /> : null}
      {tab === "eligibility" ? <Eligibility assessment={assessment} /> : null}
      {tab === "expect" ? <Expect trial={trial} burden={burden} miles={miles} /> : null}

      <StickyAction>
        {enrollment?.status === "participating" ? (
          <LinkButton href="/" variant="registered" className="w-full">Open your path</LinkButton>
        ) : inquiry ? (
          <LinkButton href={`/inquiry/${inquiry.id}`} className="w-full">
            {inquiry.state === "answered" ? "View reply" : "Open inquiry"}
          </LinkButton>
        ) : saved ? (
          <LinkButton href={`/inquiry/new/${trial.id}`} className="w-full">Prepare an inquiry</LinkButton>
        ) : (
          <form action={toggleSaveAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <input type="hidden" name="saved" value="false" />
            <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[14px] font-bold text-white">
              Save Trial
            </button>
          </form>
        )}
      </StickyAction>
    </div>
  );

}

async function Overview({
  trial: t, assessment, nearestCity, now, ask,
}: { trial: Trial; assessment: TrialAssessment; nearestCity: string | null; now: number; ask: string | null }) {
  const reply = ask?.trim() ? await answerFromSources(t, ask.trim()) : null;
  // The brief degrades rather than blocks: with no model configured the same
  // shape is assembled deterministically from the record itself.
  const brief = AI_METADATA.configured
    ? await generateTrialBrief(t, assessment).catch(() => composeOfflineBrief(t, assessment))
    : composeOfflineBrief(t, assessment);

  const facts = [
    { label: "Condition", value: t.conditions.slice(0, 2).join(", ") || "Not stated" },
    { label: "Phase", value: t.phases.length ? t.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Not stated" },
    { label: "Study type", value: t.studyType ? t.studyType[0] + t.studyType.slice(1).toLowerCase() : "Not stated" },
    { label: "Locations", value: t.sites.length ? `${t.sites.length} listed${nearestCity ? ` (nearest: ${nearestCity})` : ""}` : "None listed" },
  ];

  return (
    <section className="space-y-4">
      <div>
        <SectionHeading>Study summary</SectionHeading>
        <p className="line-clamp-4 text-[13px] leading-relaxed text-ink-soft">{brief.purpose}</p>
        <details className="group mt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1 text-[12.5px] font-bold text-ink">
            Show more <CaretRight size={12} weight="bold" className="rotate-90 transition-transform group-open:-rotate-90" />
          </summary>
          <div className="space-y-3 pb-1">
            <p className="text-[13px] leading-relaxed text-ink-soft">{brief.purpose}</p>
            <p className="text-[13px] leading-relaxed text-ink-soft">{brief.whatParticipationInvolves}</p>
            {brief.claims.map((claim, index) => (
              <div key={index} className="rounded-[16px] border border-rule p-3.5">
                <p className="text-[13px] font-bold text-ink">{claim.claim}</p>
                {claim.interpretation ? (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{claim.interpretation}</p>
                ) : null}
                <blockquote className="source-quote mt-2">{claim.supportingSpan}</blockquote>
              </div>
            ))}
          </div>
        </details>
      </div>

      <Card className="px-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-4 border-b border-rule py-3 last:border-0">
            <p className="text-[13px] text-ink-soft">{fact.label}</p>
            <p className="text-right text-[13px] font-semibold text-ink">{fact.value}</p>
          </div>
        ))}
      </Card>

      <section aria-labelledby="ask-heading" id="ask" className="scroll-mt-6">
        <SectionHeading id="ask-heading">Ask about this study</SectionHeading>
        <form action={`/trial/${t.id}#ask`} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your question about this study</span>
            <input name="ask" defaultValue={ask ?? ""} required maxLength={200} placeholder="e.g. Can I take part if I am pregnant?"
              className="min-h-12 w-full rounded-full border border-rule bg-surface px-4 text-[13.5px] text-ink placeholder:text-ink-faint" />
          </label>
          <button type="submit" className="press min-h-12 shrink-0 rounded-full border border-iris bg-iris-soft px-5 text-[13.5px] font-bold text-iris-deep hover:bg-iris hover:text-white">Ask</button>
        </form>

        {reply ? (
          <Card className="animate-rise mt-2.5 p-4" >
            <p className="text-[12px] font-bold text-ink-soft">&ldquo;{ask}&rdquo;</p>
            <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-ink">{reply.answer}</p>
            {reply.supportingSpan ? (
              <blockquote className="source-quote mt-2">{reply.supportingSpan}</blockquote>
            ) : null}
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">{reply.uncertainty}</p>
            <form action={addQuestionAction} className="mt-3">
              <input type="hidden" name="trialId" value={t.id} />
              <input type="hidden" name="text" value={ask ?? ""} />
              <input type="hidden" name="returnTo" value={`/questions?trial=${t.id}`} />
              <button type="submit" className={`press min-h-11 w-full rounded-full text-[13px] font-bold ${reply.answered ? "border border-rule-strong bg-surface text-ink hover:bg-sunken" : "cta text-white"}`}>
                Save this question
              </button>
            </form>
          </Card>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataAge date={t.lastUpdatePostDate} now={now} />
        {t.sourceUrl && !t.isFictional ? (
          <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-iris hover:underline">
            ClinicalTrials.gov record <ArrowSquareOut size={14} />
          </a>
        ) : null}
      </div>

      {!t.isFictional ? (
        <Suspense fallback={<OpenAlexResearchSkeleton />}>
          <OpenAlexResearch trial={t} />
        </Suspense>
      ) : null}
    </section>
  );
}

function Eligibility({ assessment }: { assessment: TrialAssessment }) {
  const group = (status: CriterionAssessment["status"]) => assessment.assessments.filter((a) => a.status === status);
  const groups = [
    { title: "To review", items: group("conflict") },
    { title: "Not checked", items: group("unknown") },
    { title: "Staff", items: group("needs_clinical_review") },
    { title: "Match", items: group("supported") },
  ].filter((g) => g.items.length);

  return (
    <section>
      <Card>
        {groups.map((g, index) => (
          <div key={g.title} className={index === 0 ? "" : "border-t border-rule"}>
            <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.04em] text-ink-faint">
              {g.title}
            </p>
            <ul>
              {g.items.map((item) => (
                <li key={item.criterionId} className="border-t border-rule first:border-0">
                  <details className="group">
                    <summary className="press flex cursor-pointer list-none items-start gap-3 px-4 py-3">
                      <StatusMark status={item.status} />
                      <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink group-open:font-semibold">
                        {item.criterionText}
                      </span>
                    </summary>
                    {item.evidenceSpan ? (
                      <blockquote className="source-quote mx-4 mb-3">{item.evidenceSpan}</blockquote>
                    ) : null}
                  </details>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </section>
  );
}

function StatusMark({ status }: { status: CriterionAssessment["status"] }) {
  const label =
    status === "supported" ? "Match"
      : status === "conflict" ? "To review"
      : status === "needs_clinical_review" ? "Staff"
      : "Not checked";
  const box =
    status === "supported" ? "bg-mint text-white"
      : status === "conflict" ? "bg-blush text-white"
      : status === "needs_clinical_review" ? "bg-peach-soft text-peach"
      : "border-[1.5px] border-rule-strong bg-surface text-ink-faint";
  return (
    <span
      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] ${box}`}
      aria-label={label}
    >
      {status === "supported" ? <Check size={12} weight="bold" /> : null}
      {status === "conflict" ? <span className="text-[11px] font-bold leading-none">!</span> : null}
      {status === "needs_clinical_review" ? <Minus size={12} weight="bold" /> : null}
    </span>
  );
}

function Expect({
  trial, burden, miles,
}: {
  trial: Trial;
  burden: BurdenPreview;
  miles: number | null;
}) {
  const schedule = trial.visitSchedule;
  const pay = trial.knownLogistics?.compensationStated ? trial.knownLogistics.compensationText : null;

  const facts = [
    burden.weeksSpanned != null ? { label: "Duration", value: `${burden.weeksSpanned} weeks` } : null,
    schedule ? null : { label: "Visits", value: "Not published" },
    { label: "Travel", value: miles != null ? `${miles} miles` : "Not known" },
  ].filter((fact): fact is { label: string; value: string } => fact != null);

  return (
    <Card>
      <div className="px-4 py-3.5">
        {burden.available ? (
          <p className="flex items-baseline gap-2">
            <span className="text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-ink">{burden.totalHours}</span>
            <span className="text-[13px] text-ink-soft">hours{burden.partial ? ", travel not included" : ""}</span>
          </p>
        ) : (
          <p className="text-[15px] font-bold text-ink">Time not published</p>
        )}
      </div>
      <ul>
        {facts.map((fact) => (
          <li key={fact.label} className="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3">
            <span className="text-[13px] text-ink-soft">{fact.label}</span>
            <span className="text-right text-[13px] font-semibold text-ink">{fact.value}</span>
          </li>
        ))}
      </ul>
      {schedule?.visits.length ? (
        <ul className="border-t border-rule">
          {schedule.visits.map((visit) => (
            <li key={visit.name} className="flex items-baseline justify-between gap-4 border-t border-rule px-4 py-3 first:border-0">
              <span className="min-w-0 text-[13.5px] leading-snug text-ink">{visit.name}</span>
              <span className="shrink-0 text-[13px] font-semibold text-ink">{visit.onSiteHours}h</span>
            </li>
          ))}
        </ul>
      ) : null}
      {pay ? (
        <p className="border-t border-rule px-4 py-3 text-[13px] leading-relaxed text-ink-soft">{pay}</p>
      ) : null}
    </Card>
  );
}
