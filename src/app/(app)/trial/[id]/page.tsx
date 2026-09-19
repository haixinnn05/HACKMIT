import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowSquareOut, Buildings, CaretLeft, CaretRight, ClipboardText, Flask, Heart, MapPin,
  Heartbeat, PaperPlaneTilt, ShieldCheck, Timer,
} from "@phosphor-icons/react/dist/ssr";
import { OpenAlexResearch, OpenAlexResearchSkeleton } from "@/components/OpenAlexResearch";
import { Hills } from "@/components/Brand";
import {
  Callout, Card, DataAge, FictionBanner, LinkButton, SectionHeading, StatusChip, StickyAction, Tabs,
} from "@/components/ui";
import { AI_METADATA, answerFromSources, composeOfflineBrief, generateTrialBrief } from "@/lib/ai";
import { assessTrial } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { requestNow } from "@/lib/clock";
import { getTrial, listQuestions, listSavedTrialIds, recordMilestone } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { addQuestionAction, toggleSaveAction } from "@/app/actions";
import type { CriterionAssessment, Trial, TrialAssessment } from "@/lib/types";
import { isAnswered } from "@/lib/questions";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

export default async function TrialPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; ask?: string }> }) {
  const { id } = await params;
  const { tab: rawTab, ask } = await searchParams;
  const tab = rawTab === "eligibility" || rawTab === "expect" ? rawTab : "overview";

  const trial = getTrial(decodeURIComponent(id));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const now = requestNow();
  const assessment = assessTrial(trial, participant);
  const burden = computeBurden(trial, participant);
  const saved = listSavedTrialIds(participant.id).includes(trial.id);
  const openQuestions = listQuestions({ participantId: participant.id, trialId: trial.id }).filter((q) => !isAnswered(q));

  // Going past the overview is what "reviewed" means. The stamp is earned once.
  if (tab !== "overview") {
    recordMilestone(participant.id, "reviewed_overview", "Reviewed the study overview", trial.id);
  }

  const site = assessment.practicalFit.nearestSite;
  const miles = assessment.practicalFit.nearestSiteKm != null
    ? Math.round(assessment.practicalFit.nearestSiteKm / KM_PER_MILE) : null;
  const condition = trial.conditions[0];
  const base = `/trial/${trial.id}`;

  const headline =
    assessment.overall === "likely_conflict"
      ? { title: "Things to review", body: "Something you told us may not match a requirement. Wording is often stricter than practice, so ask before ruling it out.", tone: "bg-iris-soft", icon: "text-iris" }
      : assessment.overall === "needs_more_information"
        ? { title: "Questions remain", body: "We can't check most requirements from what you've told us so far. That's a list of questions, not a no.", tone: "bg-peach-soft", icon: "text-peach" }
        : { title: "Potential option", body: "Nothing you told us conflicts with this study. Only its team can decide who takes part, so it's worth a conversation.", tone: "bg-mint-soft", icon: "text-mint" };

  return (
    <div className="space-y-4">
      {/* A thin art band holds the controls; the title sits on white, as on the board. */}
      <div className="relative -mx-5 -mt-5 h-[4.75rem] overflow-hidden bg-lavender px-5 pt-3">
        <Hills />
        <div className="relative flex items-center justify-between">
          <Link href="/explore" className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <CaretLeft size={20} weight="bold" /><span className="sr-only">Back to trials</span>
          </Link>
          <form action={toggleSaveAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <input type="hidden" name="saved" value={String(saved)} />
            <button type="submit" className="press -mr-2.5 grid size-11 place-items-center rounded-full text-iris hover:bg-ink/5">
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
        <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-soft">
          <MapPin size={14} className="text-iris" />
          {site?.city ? `${site.city}${site.state ? `, ${site.state}` : ""}${miles != null ? ` (about ${miles} miles)` : ""}` : "Location not known"}
        </p>
      </header>

      {trial.isFictional ? <FictionBanner /> : null}

      <div className={`flex items-start gap-2.5 rounded-[14px] px-3.5 py-2.5 ${headline.tone}`}>
        <ShieldCheck size={18} weight="fill" className={`mt-0.5 shrink-0 ${headline.icon}`} />
        <div>
          <p className="text-[13px] font-bold text-ink">{headline.title}</p>
          <p className="text-[12px] leading-snug text-ink-soft">{headline.body}</p>
        </div>
      </div>

      <Tabs
        variant="underline" current={tab}
        tabs={[
          { id: "overview", label: "Overview", href: base },
          { id: "eligibility", label: "Eligibility", href: `${base}?tab=eligibility` },
          { id: "expect", label: "What to Expect", href: `${base}?tab=expect` },
        ]}
      />

      {tab === "overview" ? <Overview trial={trial} assessment={assessment} nearestCity={site?.city ?? null} now={now} ask={ask?.slice(0, 200) ?? null} /> : null}
      {tab === "eligibility" ? <Eligibility assessment={assessment} /> : null}
      {tab === "expect" ? (
        <section className="space-y-4">
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris"><Timer size={22} /></span>
              <div className="min-w-0">
                {burden.available ? (
                  <>
                    <p className="text-[15px] font-bold text-ink">About {burden.totalHours} hours in total</p>
                    <p className="font-mono text-[11.5px] leading-relaxed text-ink-faint">{burden.formula}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[15px] font-bold text-ink">The time commitment is not published</p>
                    <p className="text-[12.5px] leading-relaxed text-ink-soft">
                      This study does not publish its visit schedule, and we will not guess one from its length.
                    </p>
                  </>
                )}
              </div>
            </div>
            <LinkButton href={`${base}/preview`} variant="secondary" className="mt-3.5 w-full">
              Open Participation Preview <CaretRight size={14} weight="bold" />
            </LinkButton>
          </Card>

          <div>
            <SectionHeading>Practical situation</SectionHeading>
            <Card className="p-4">
              <ul className="space-y-2">
                {assessment.practicalFit.notes.map((note) => (
                  <li key={note} className="text-[13px] leading-relaxed text-ink-soft">{note}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                {trial.sites.length} {trial.sites.length === 1 ? "location" : "locations"} listed in the record.
              </p>
            </Card>
          </div>

          <Card>
            <Link href={`/questions?trial=${trial.id}`} className="press flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris"><ClipboardText size={22} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink">Saved questions for this study</span>
                <span className="block text-[12.5px] text-ink-soft">
                  {openQuestions.length === 0 ? "None yet. Add what this record leaves unanswered." : `${openQuestions.length} waiting to be asked`}
                </span>
              </span>
              <CaretRight size={16} weight="bold" className="text-ink-faint" />
            </Link>
          </Card>
        </section>
      ) : null}

      <StickyAction>
        {saved ? (
          <LinkButton href={`/inquiry/new/${trial.id}`} className="w-full">
            <PaperPlaneTilt size={18} weight="bold" /> Prepare an inquiry
          </LinkButton>
        ) : (
          <form action={toggleSaveAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <input type="hidden" name="saved" value="false" />
            <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[14px] font-bold text-white">
              <Heart size={18} weight="bold" /> Save Trial
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
    { icon: <Heartbeat size={20} />, label: "Condition", value: t.conditions.slice(0, 2).join(", ") || "Not stated" },
    { icon: <Flask size={20} />, label: "Phase", value: t.phases.length ? t.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Not stated" },
    { icon: <Buildings size={20} />, label: "Study type", value: t.studyType ? t.studyType[0] + t.studyType.slice(1).toLowerCase() : "Not stated" },
    { icon: <MapPin size={20} />, label: "Locations", value: t.sites.length ? `${t.sites.length} listed${nearestCity ? ` (nearest: ${nearestCity})` : ""}` : "None listed in the record" },
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
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{claim.interpretation}</p>
                <blockquote className="source-quote mt-2">{claim.supportingSpan}</blockquote>
                <p className="mt-1.5 text-[11px] text-ink-faint">{claim.sourceLabel}, version {claim.sourceVersion}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-peach"><strong>What this does not tell you:</strong> {claim.uncertainty}</p>
              </div>
            ))}
            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              {brief.mode === "model"
                ? `Written by a language model from the sources above and checked against them.${brief.droppedClaims > 0 ? ` ${brief.droppedClaims} statement(s) were removed because the quoted text was not found in the source.` : ""}`
                : "Assembled by rule directly from the record. No language model was involved."}{" "}
              This is a summary to help you ask questions. It is not the study&rsquo;s consent form.
            </p>
          </div>
        </details>
      </div>

      <Card className="px-4">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-center gap-3.5 border-b border-rule py-3 last:border-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lavender text-iris">{fact.icon}</span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-ink">{fact.label}</p>
              <p className="text-[12.5px] text-ink-soft">{fact.value}</p>
            </div>
          </div>
        ))}
      </Card>

      <section aria-labelledby="ask-heading" id="ask" className="scroll-mt-6">
        <SectionHeading id="ask-heading" hint="We search this study&rsquo;s own text and quote what we find. If it isn&rsquo;t there, we say so.">
          Ask about this study
        </SectionHeading>
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
              <>
                <blockquote className="source-quote mt-2">{reply.supportingSpan}</blockquote>
                <p className="mt-1.5 text-[11px] text-ink-faint">{reply.sourceLabel}</p>
              </>
            ) : null}
            <p className="mt-2 text-[11.5px] leading-relaxed text-peach"><strong>Keep in mind:</strong> {reply.uncertainty}</p>
            <form action={addQuestionAction} className="mt-3">
              <input type="hidden" name="trialId" value={t.id} />
              <input type="hidden" name="text" value={ask ?? ""} />
              <input type="hidden" name="returnTo" value={`/questions?trial=${t.id}`} />
              <button type="submit" className={`press min-h-11 w-full rounded-full text-[13px] font-bold ${reply.answered ? "border border-rule-strong bg-surface text-ink hover:bg-sunken" : "cta text-white"}`}>
                {reply.answered ? "Still unsure? Save this for the study team" : "Save this question for the study team"}
              </button>
            </form>
            <p className="mt-2 text-[11px] text-ink-faint">
              {reply.mode === "model" ? "Found with a language model, and the quote was checked against the record." : "Found by keyword search. No language model was involved."}
            </p>
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
    { title: "Possible conflicts", items: group("conflict"), open: true, hint: "Something you recorded appears to go against a requirement. Raise these rather than assuming." },
    { title: "Cannot be checked yet", items: group("unknown"), open: false, hint: "Not barriers. These need information you have not recorded, or that only a clinician can assess." },
    { title: "Needs staff review", items: group("needs_clinical_review"), open: false, hint: "These depend on test results or study rules. We will not estimate them." },
    { title: "Matches what you recorded", items: group("supported"), open: false, hint: "Based only on what you entered, which has not been checked against medical records." },
  ];

  return (
    <section className="space-y-4">
      <Callout title="Every observation here is provisional">
        Only the study&rsquo;s investigators decide who can take part. Each item below shows the exact
        wording it came from.
      </Callout>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Matched", value: assessment.supported },
          { label: "To review", value: assessment.conflicts },
          { label: "Unanswered", value: assessment.unknowns },
          { label: "Staff review", value: assessment.needsReview },
        ].map((stat) => (
          <Card key={stat.label} className="px-2 py-2.5 text-center">
            <p className="text-[1.15rem] font-bold text-ink">{stat.value}</p>
            <p className="text-[10.5px] leading-tight text-ink-soft">{stat.label}</p>
          </Card>
        ))}
      </div>

      {assessment.missingInformation.length ? (
        <Card className="p-4">
          <p className="text-[13.5px] font-bold text-ink">What would answer the most questions</p>
          <ul className="mt-1.5 space-y-1">
            {assessment.missingInformation.map((missing) => (
              <li key={missing.key} className="text-[12.5px] text-ink-soft">
                <strong className="font-bold text-ink">{missing.label}</strong>, affects {missing.affectedCriteria} requirement{missing.affectedCriteria === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {groups.filter((g) => g.items.length).map((g, index) => (
        <Card key={g.title} className="p-4">
          {/* The first non-empty group opens, so the page never starts as four closed boxes. */}
          <details open={g.open || index === 0} className="group">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2">
              <span className="text-[13.5px] font-bold text-ink">{g.title} ({g.items.length})</span>
              <CaretRight size={14} weight="bold" className="rotate-90 text-ink-faint transition-transform group-open:-rotate-90" />
            </summary>
            <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-soft">{g.hint}</p>
            <ul className="space-y-2.5">
              {g.items.map((item) => (
                <li key={item.criterionId} className="rounded-[14px] border border-rule p-3">
                  <StatusChip status={item.status} />
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{item.rationale}</p>
                  <details className="mt-1">
                    <summary className="flex min-h-11 cursor-pointer items-center text-[12px] font-bold text-iris">
                      Show the exact wording from the record
                    </summary>
                    <blockquote className="source-quote">{item.evidenceSpan}</blockquote>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {item.role === "exclusion" ? "Exclusion criterion" : item.role === "inclusion" ? "Inclusion criterion" : "Criterion"}
                      {item.logic === "any_of" ? ", lists alternatives" : ""}
                      {item.sourceStart >= 0 ? `, characters ${item.sourceStart} to ${item.sourceEnd}` : ", structured registry field"}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ))}
    </section>
  );
}
