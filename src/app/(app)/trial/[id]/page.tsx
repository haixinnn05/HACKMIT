import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowSquareOut, CaretLeft, CaretRight, Check, Heart, Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { OpenAlexResearch, OpenAlexResearchSkeleton } from "@/components/OpenAlexResearch";
import { Hills } from "@/components/Brand";
import {
  Card, DataAge, LinkButton, SectionHeading, StickyAction, Tabs,
} from "@/components/ui";
import { AI_METADATA, answerFromSources, cachedTrialBrief, composeOfflineBrief, generateTrialBrief, type TrialBrief } from "@/lib/ai";
import { assessTrial, criteriaMatchCopy } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { requestNow } from "@/lib/clock";
import { getOpenInquiryForTrial, getParticipatingEnrollment, getTrial, listConfirmedCriterionIds, listEnrollments, listSavedTrialIds, recordMilestone } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { openedFromMap } from "@/lib/map-return";
import { addQuestionAction, toggleCriterionCheckAction, toggleSaveAction } from "@/app/actions";
import type { CriterionAssessment, Trial, TrialAssessment } from "@/lib/types";
import type { BurdenPreview } from "@/lib/burden";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

export default async function TrialPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; ask?: string; from?: string; visits?: string; travel?: string; plain?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, ask, from, visits, travel, plain } = await searchParams;
  const tab = rawTab === "eligibility" || rawTab === "expect" || rawTab === "insight" ? rawTab : "overview";

  const trial = getTrial(decodeURIComponent(id));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const now = requestNow();
  const confirmedIds = listConfirmedCriterionIds(participant.id, trial.id);
  const assessment = assessTrial(trial, participant, confirmedIds);
  const burden = computeBurden(trial, participant, {
    oneWayTravelMinutes: participant.oneWayTravelMinutes,
    visitCountOverride: visits ? Number(visits) : null,
    travelOverrideMinutes: travel ? Number(travel) : null,
  });
  const saved = listSavedTrialIds(participant.id).includes(trial.id);
  const inquiry = getOpenInquiryForTrial(participant.id, trial.id);
  const enrollment = listEnrollments(participant.id).find((entry) => entry.trialId === trial.id);
  const underway = getParticipatingEnrollment(participant.id);
  const otherStudy = Boolean(underway && underway.trialId !== trial.id);

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
  const peersHref = (() => {
    const query = new URLSearchParams({ trial: trial.id });
    if (tab !== "overview") query.set("tab", tab);
    if (fromMap) query.set("from", "map");
    return `/peers?${query}`;
  })();

  const fit = criteriaMatchCopy(assessment);
  const alreadyTookPart = enrollment?.status === "completed";
  const cannotApply = alreadyTookPart || otherStudy;

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

      <Link href={tabHref("eligibility")} className={`block rounded-[16px] px-3.5 py-2.5 ${fit.box}`}>
        <p className={`text-[12.5px] font-bold ${fit.titleClass}`}>{fit.title}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-ink">{fit.body}</p>
      </Link>

      <Card className="overflow-hidden [&>a]:border-b [&>a]:border-rule [&>a:last-child]:border-0">
        {alreadyTookPart ? (
          <p className="px-3.5 py-2.5 text-[13px] leading-snug text-ink-soft">You already took part in this study.</p>
        ) : otherStudy ? (
          <p className="px-3.5 py-2.5 text-[13px] leading-snug text-ink-soft">You can take part in one study at a time.</p>
        ) : (
          <Link href={`/apply/${trial.id}`} className="press flex min-h-11 items-center gap-2 px-3.5 py-2 hover:bg-sunken">
            <span className="min-w-0 flex-1 text-[13px] font-bold text-ink">Application form</span>
            <CaretRight size={14} weight="bold" className="shrink-0 text-ink-faint" />
          </Link>
        )}
        <Link href={peersHref} className="press flex min-h-11 items-center gap-2 px-3.5 py-2 hover:bg-sunken">
          <span className="min-w-0 flex-1 text-[13px] font-bold text-ink">Talk with someone like you</span>
          <CaretRight size={14} weight="bold" className="shrink-0 text-ink-faint" />
        </Link>
      </Card>

      <Tabs
        variant="underline" current={tab}
        tabs={[
          { id: "overview", label: "Overview", href: tabHref() },
          { id: "eligibility", label: "Eligibility", href: tabHref("eligibility") },
          { id: "expect", label: "What to Expect", href: tabHref("expect") },
          { id: "insight", label: "Insight", href: tabHref("insight") },
        ]}
      />

      {tab === "overview" ? <Overview trial={trial} assessment={assessment} nearestCity={site?.city ?? null} now={now} ask={ask?.slice(0, 200) ?? null} plain={plain === "1"} /> : null}
      {tab === "eligibility" ? <Eligibility trialId={trial.id} assessment={assessment} confirmedIds={confirmedIds} /> : null}
      {tab === "expect" ? <Expect trial={trial} burden={burden} miles={miles} /> : null}
      {tab === "insight" ? (
        <Suspense fallback={<OpenAlexResearchSkeleton />}>
          <OpenAlexResearch trial={trial} />
        </Suspense>
      ) : null}

      {enrollment?.status === "participating" ? (
        <StickyAction>
          <LinkButton href="/" variant="registered" className="w-full">Open your path</LinkButton>
        </StickyAction>
      ) : cannotApply ? (
        otherStudy ? (
          <StickyAction>
            <LinkButton href="/" variant="registered" className="w-full">Open your path</LinkButton>
          </StickyAction>
        ) : null
      ) : (
        <StickyAction>
          {inquiry ? (
            <LinkButton href={`/inquiry/${inquiry.id}`} className="w-full">
              {inquiry.state === "answered" ? "View reply" : "Open inquiry"}
            </LinkButton>
          ) : saved ? (
            <LinkButton href={`/apply/${trial.id}`} className="w-full">Apply</LinkButton>
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
      )}
    </div>
  );

}

async function Overview({
  trial: t, assessment, nearestCity, now, ask, plain,
}: { trial: Trial; assessment: TrialAssessment; nearestCity: string | null; now: number; ask: string | null; plain: boolean }) {
  // The rule-built brief is instant and always available. It is what the page
  // shows first, and what it keeps showing if the model is slow or fails.
  const instant = composeOfflineBrief(t, assessment);
  // A model-written brief is shown by itself only when it already exists. Writing
  // a new one takes up to a minute and costs money, so that waits for a tap.
  const ready = AI_METADATA.configured ? await cachedTrialBrief(t, assessment) : null;

  const facts = [
    { label: "Condition", value: t.conditions.slice(0, 2).join(", ") || "Not stated" },
    { label: "Phase", value: t.phases.length ? t.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Not stated" },
    { label: "Study type", value: t.studyType ? t.studyType[0] + t.studyType.slice(1).toLowerCase() : "Not stated" },
    { label: "Locations", value: t.sites.length ? `${t.sites.length} listed${nearestCity ? ` (nearest: ${nearestCity})` : ""}` : "None listed" },
  ];

  return (
    <section className="space-y-4">
      <div id="summary" className="scroll-mt-6">
        {ready ? <BriefView brief={ready} /> : plain && AI_METADATA.configured ? (
          <Suspense fallback={<BriefView brief={instant} writing />}>
            <ModelBrief trial={t} assessment={assessment} instant={instant} />
          </Suspense>
        ) : (
          <>
            <BriefView brief={instant} />
            {AI_METADATA.configured ? (
              <Link href={`/trial/${t.id}?plain=1#summary`} scroll={false}
                className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-full border border-iris bg-iris-soft text-[13.5px] font-bold text-iris-deep hover:bg-iris hover:text-white">
                <Sparkle size={16} weight="fill" /> Explain this in plain language
              </Link>
            ) : null}
          </>
        )}
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

        {ask?.trim() ? (
          <Suspense key={ask} fallback={
            <Card className="mt-2.5 space-y-2 p-4" >
              <p className="text-[12px] font-bold text-ink-soft">&ldquo;{ask}&rdquo;</p>
              <p className="text-[13px] text-ink-soft">Reading this study&rsquo;s record&hellip;</p>
              <div className="h-3 w-11/12 animate-pulse rounded-full bg-sunken" /><div className="h-3 w-2/3 animate-pulse rounded-full bg-sunken" />
            </Card>
          }>
            <AskAnswer trial={t} ask={ask.trim()} />
          </Suspense>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataAge date={t.lastUpdatePostDate} now={now} />
        {t.sourceUrl && !t.isFictional ? (
          <a href={t.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1 text-[12.5px] font-bold text-iris hover:underline">
            ClinicalTrials.gov record <ArrowSquareOut size={14} />
          </a>
        ) : t.isFictional && t.leadSponsor ? (
          <span className="text-[12.5px] font-semibold text-ink-soft">Posted on Mozaic by {t.leadSponsor}</span>
        ) : null}
      </div>
    </section>
  );
}

/** The model-written brief. If it fails or is slow, the instant one simply stays. */
async function ModelBrief({ trial, assessment, instant }: { trial: Trial; assessment: TrialAssessment; instant: TrialBrief }) {
  const brief = await generateTrialBrief(trial, assessment).catch(() => instant);
  return <BriefView brief={brief} />;
}

function BriefView({ brief, writing = false }: { brief: TrialBrief; writing?: boolean }) {
  return (
    <div>
      <SectionHeading trailing={writing ? "Writing a plain-language version" : undefined}>Study summary</SectionHeading>
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
  );
}

async function AskAnswer({ trial, ask }: { trial: Trial; ask: string }) {
  const reply = await answerFromSources(trial, ask);
  return (
    <Card className="animate-rise mt-2.5 p-4" >
      <p className="text-[12px] font-bold text-ink-soft">&ldquo;{ask}&rdquo;</p>
      <p className="mt-1 text-[13.5px] font-semibold leading-relaxed text-ink">{reply.answer}</p>
      {reply.supportingSpan ? (
        <blockquote className="source-quote mt-2">{reply.supportingSpan}</blockquote>
      ) : null}
      {reply.uncertainty ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">{reply.uncertainty}</p>
      ) : null}
      <form action={addQuestionAction} className="mt-3">
        <input type="hidden" name="trialId" value={trial.id} />
        <input type="hidden" name="text" value={ask} />
        <input type="hidden" name="returnTo" value={`/questions?trial=${trial.id}`} />
        <button type="submit" className={`press min-h-11 w-full rounded-full text-[13px] font-bold ${reply.answered ? "border border-rule-strong bg-surface text-ink hover:bg-sunken" : "cta text-white"}`}>
          Save this question
        </button>
      </form>
    </Card>
  );
}

function Eligibility({
  trialId, assessment, confirmedIds,
}: {
  trialId: string;
  assessment: TrialAssessment;
  confirmedIds: string[];
}) {
  const confirmed = new Set(confirmedIds);
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
              {g.items.map((item) => {
                const marked = confirmed.has(item.criterionId);
                const matched = item.status === "supported";
                const locked = matched && !marked;
                return (
                <li key={item.criterionId} className="border-t border-rule first:border-0">
                  <div className="flex items-start gap-3 px-4 py-3">
                    <form action={toggleCriterionCheckAction}>
                      <input type="hidden" name="trialId" value={trialId} />
                      <input type="hidden" name="criterionId" value={item.criterionId} />
                      <button
                        type="submit"
                        role="checkbox"
                        aria-checked={matched}
                        disabled={locked}
                        aria-label={matched ? `Marked as matching: ${item.criterionText}` : `Mark as matching: ${item.criterionText}`}
                        className="press mt-0.5 shrink-0 disabled:cursor-default"
                      >
                        <StatusMark matched={matched} />
                      </button>
                    </form>
                    <details className="group min-w-0 flex-1">
                      <summary className="press cursor-pointer list-none">
                        <span className="text-[13.5px] leading-snug text-ink group-open:font-semibold">
                          {item.criterionText}
                        </span>
                      </summary>
                      {item.evidenceSpan ? (
                        <blockquote className="source-quote mt-2">{item.evidenceSpan}</blockquote>
                      ) : null}
                    </details>
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Card>
    </section>
  );
}

function StatusMark({ matched }: { matched: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-6 place-items-center rounded-[8px] ${
        matched ? "border-2 border-mint bg-mint text-white" : "border-2 border-rule-strong bg-surface text-transparent"
      }`}
    >
      <Check size={14} weight="bold" />
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
