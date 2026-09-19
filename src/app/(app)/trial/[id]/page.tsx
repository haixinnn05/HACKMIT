import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Card, DataAge, FictionBanner, LinkButton, Note, ProvenanceTag, SectionHeading, StatusChip,
} from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import { computeBurden } from "@/lib/burden";
import { composeOfflineBrief, generateTrialBrief, AI_METADATA } from "@/lib/ai";
import { getTrial, listQuestions, listSavedTrialIds } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { requestNow } from "@/lib/clock";
import {
  addQuestionAction, markReviewedAction, removeQuestionAction, toggleSaveAction,
} from "@/app/actions";
import type { CriterionAssessment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrialPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visits?: string; travel?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const trial = getTrial(decodeURIComponent(id));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const now = requestNow();
  const assessment = assessTrial(trial, participant);

  const burden = computeBurden(trial, participant, {
    oneWayTravelMinutes: participant.oneWayTravelMinutes,
    visitCountOverride: query.visits ? Number(query.visits) : null,
    travelOverrideMinutes: query.travel ? Number(query.travel) : null,
  });

  // The brief degrades rather than blocks: with no model configured, the same
  // shape is assembled deterministically from the record itself.
  const brief = AI_METADATA.configured
    ? await generateTrialBrief(trial, assessment).catch(() => composeOfflineBrief(trial, assessment))
    : composeOfflineBrief(trial, assessment);

  const saved = listSavedTrialIds(participant.id).includes(trial.id);
  const questions = listQuestions({ participantId: participant.id, trialId: trial.id });

  const conflicts = assessment.assessments.filter((a) => a.status === "conflict");
  const unknowns = assessment.assessments.filter((a) => a.status === "unknown");
  const reviews = assessment.assessments.filter((a) => a.status === "needs_clinical_review");
  const supported = assessment.assessments.filter((a) => a.status === "supported");

  return (
    <div className="space-y-6">
      <Link href="/explore" className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">← Back to options</Link>

      <header className="page-intro space-y-3">
        {trial.isFictional ? <FictionBanner /> : null}
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.025em] text-ink">
          {trial.briefTitle ?? trial.id}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          <span className="font-mono">{trial.id}</span>
          {trial.leadSponsor ? <span>{trial.leadSponsor}</span> : null}
          {trial.phases.length ? <span>{trial.phases.join(", ").replace(/PHASE/g, "Phase ")}</span> : null}
          <span>{trial.enrollmentCount ? `${trial.enrollmentCount} participants planned` : "Planned size not stated"}</span>
        </div>
        <DataAge date={trial.lastUpdatePostDate} now={now} />
        {trial.sourceUrl && !trial.isFictional ? (
          <p className="text-sm">
            <a href={trial.sourceUrl} target="_blank" rel="noreferrer" className="text-teal hover:underline">
              Read the full record on ClinicalTrials.gov ↗
            </a>
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <form action={toggleSaveAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <input type="hidden" name="saved" value={String(saved)} />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
            >
              {saved ? "★ Saved" : "☆ Save this option"}
            </button>
          </form>
          <form action={markReviewedAction}>
            <input type="hidden" name="trialId" value={trial.id} />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
            >
              Mark overview as read
            </button>
          </form>
        </div>
      </header>

      {/* --------------------------------------------------------- the brief */}
      <section aria-labelledby="brief-heading">
        <SectionHeading id="brief-heading" hint={brief.notice}>What this study is</SectionHeading>
        <Card className="space-y-4 p-4">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">Purpose</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{brief.purpose}</p>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">What taking part involves</h3>
            <p className="text-sm leading-relaxed text-ink-soft">{brief.whatParticipationInvolves}</p>
          </div>

          {brief.claims.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">The evidence behind this</h3>
              <ul className="space-y-3">
                {brief.claims.map((claim, index) => (
                  <li key={index} className="rounded-lg border border-rule p-3">
                    <p className="text-sm font-medium text-ink">{claim.claim}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{claim.interpretation}</p>
                    <blockquote className="source-quote mt-2">{claim.supportingSpan}</blockquote>
                    <p className="mt-1.5 text-[11px] text-ink-faint">
                      {claim.sourceLabel} · version {claim.sourceVersion}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-amber">
                      <strong className="font-semibold">What this does not tell you:</strong>{" "}
                      {claim.uncertainty}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-rule pt-3 text-xs leading-relaxed text-ink-faint">
            {brief.mode === "model"
              ? `Written by a language model from the sources above and checked against them. ${brief.droppedClaims > 0 ? `${brief.droppedClaims} statement${brief.droppedClaims === 1 ? " was" : "s were"} removed because the quoted text could not be found in the source.` : "Every quoted span was found in the source."}`
              : "Assembled by Trial Passport&rsquo;s own rules directly from the record. No language model was involved."}{" "}
            This is a summary to help you ask questions. It is not the study&rsquo;s consent form.
          </p>
        </Card>
      </section>

      {/* ------------------------------------------------- participation preview */}
      <section aria-labelledby="burden-heading">
        <SectionHeading
          id="burden-heading"
          hint="What taking part would cost you in time, worked out from the schedule and your own travel."
        >
          Participation preview
        </SectionHeading>

        {!burden.available ? (
          <Card className="space-y-3 p-4">
            <p className="text-sm leading-relaxed text-ink">{burden.unavailableReason}</p>
            <ul className="space-y-1.5">
              {burden.lines.map((line) => (
                <li key={line.label} className="flex flex-wrap items-center justify-between gap-2 border-b border-rule py-1.5 text-sm last:border-0">
                  <span className="text-ink">{line.label}</span>
                  <ProvenanceTag provenance={line.provenance} />
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">Worth asking the study team</p>
              <ul className="space-y-1">
                {burden.openQuestions.map((question) => (
                  <li key={question} className="text-sm leading-relaxed text-ink-soft">· {question}</li>
                ))}
              </ul>
            </div>
          </Card>
        ) : (
          <Card className="space-y-4 p-4">
            {burden.hypothetical ? (
              <Note tone="caution">
                This is a hypothetical you typed in. The study has not agreed to it. Treat it as a
                question to ask, not a schedule you can expect.
              </Note>
            ) : null}

            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight text-ink">{burden.totalHours}</span>
              <span className="text-sm text-ink-soft">
                hours in total{burden.weeksSpanned ? `, across about ${burden.weeksSpanned} weeks` : ""}
              </span>
            </div>
            {burden.formula ? (
              <p className="font-mono text-xs text-ink-faint">{burden.formula}</p>
            ) : null}

            <ul className="space-y-0">
              {burden.lines.map((line) => (
                <li key={line.label} className="flex flex-wrap items-start justify-between gap-2 border-b border-rule py-2.5 text-sm last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{line.label}</p>
                    <p className="text-xs leading-relaxed text-ink-soft">{line.detail}</p>
                    <div className="mt-1"><ProvenanceTag provenance={line.provenance} /></div>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-ink">
                    {line.hours != null ? `${line.hours}h` : "—"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border border-rule bg-paper-sunken p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Not included in this number
              </p>
              <p className="text-sm leading-relaxed text-ink-soft">{burden.exclusions.join(" · ")}</p>
            </div>

            {/* "What if" — explicitly hypothetical until a site confirms it. */}
            <form className="rounded-lg border border-rule p-3" action={`/trial/${trial.id}`}>
              <p className="mb-2 text-sm font-medium text-ink">What if it were different?</p>
              <p className="mb-2.5 text-xs leading-relaxed text-ink-soft">
                Change these to see what you would be asking for. Nothing here is agreed
                by the study.
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-ink-soft">
                  On-site visits
                  <input
                    type="number" name="visits" min={1} max={40}
                    defaultValue={query.visits ?? burden.visitCount ?? 4}
                    className="mt-1 block min-h-11 w-28 rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink"
                  />
                </label>
                <label className="text-xs text-ink-soft">
                  Travel each way (min)
                  <input
                    type="number" name="travel" min={0} max={600}
                    defaultValue={query.travel ?? participant.oneWayTravelMinutes ?? 45}
                    className="mt-1 block min-h-11 w-36 rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-auto min-h-11 rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
                >
                  Recalculate
                </button>
              </div>
            </form>

            {burden.openQuestions.length ? (
              <div>
                <p className="mb-1.5 text-sm font-medium text-ink">Still unanswered</p>
                <ul className="space-y-1">
                  {burden.openQuestions.map((question) => (
                    <li key={question} className="text-sm leading-relaxed text-ink-soft">· {question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )}
      </section>

      {/* ------------------------------------------------------- eligibility */}
      <section aria-labelledby="criteria-heading">
        <SectionHeading
          id="criteria-heading"
          hint="Every observation below is provisional. Only the study's investigators decide who can take part."
        >
          How this compares with what you recorded
        </SectionHeading>

        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Matched", value: assessment.supported },
            { label: "Possible conflicts", value: assessment.conflicts },
            { label: "Unanswered", value: assessment.unknowns },
            { label: "Needs staff review", value: assessment.needsReview },
          ].map((stat) => (
            <Card key={stat.label} className="p-2.5">
              <p className="text-xl font-semibold text-ink">{stat.value}</p>
              <p className="text-xs leading-snug text-ink-soft">{stat.label}</p>
            </Card>
          ))}
        </div>

        {assessment.missingInformation.length ? (
          <Card className="mb-3 p-4">
            <h3 className="mb-1 text-sm font-semibold text-ink">
              What would answer the most questions
            </h3>
            <p className="mb-2 text-sm leading-relaxed text-ink-soft">
              Adding these to your passport, or asking a coordinator for them, would let more of
              this study&rsquo;s requirements be checked.
            </p>
            <ul className="space-y-1">
              {assessment.missingInformation.map((missing) => (
                <li key={missing.key} className="text-sm text-ink-soft">
                  · <strong className="font-medium text-ink">{missing.label}</strong> — affects{" "}
                  {missing.affectedCriteria} requirement{missing.affectedCriteria === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <div className="space-y-4">
          <CriterionGroup
            title="Possible conflicts"
            description="Something you recorded appears to go against a requirement. Criteria are often more flexible than the wording suggests — raise these rather than assuming."
            items={conflicts} trial={trial.id}
          />
          <CriterionGroup
            title="Cannot be checked yet"
            description="Not barriers. These are the requirements that need information you have not recorded, or that only a clinician can assess."
            items={unknowns} trial={trial.id} collapsed
          />
          <CriterionGroup
            title="Needs staff review"
            description="These depend on test results or study-specific rules. Trial Passport will not estimate them."
            items={reviews} trial={trial.id} collapsed
          />
          <CriterionGroup
            title="Matches what you recorded"
            description="Based only on what you entered, which has not been checked against your medical records."
            items={supported} trial={trial.id} collapsed
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- practical */}
      <section aria-labelledby="practical-heading">
        <SectionHeading id="practical-heading">Practical situation</SectionHeading>
        <Card className="space-y-3 p-4">
          {assessment.practicalFit.nearestSite ? (
            <div>
              <p className="text-sm font-medium text-ink">
                {assessment.practicalFit.nearestSite.facility ?? "Listed site"}
              </p>
              <p className="text-sm text-ink-soft">
                {[
                  assessment.practicalFit.nearestSite.city,
                  assessment.practicalFit.nearestSite.state,
                  assessment.practicalFit.nearestSite.country,
                ].filter(Boolean).join(", ")}
                {" · "}
                {assessment.practicalFit.nearestSite.siteStatus
                  ? `site status: ${assessment.practicalFit.nearestSite.siteStatus.toLowerCase().replace(/_/g, " ")}`
                  : "site-level recruiting status not published"}
              </p>
            </div>
          ) : null}
          <ul className="space-y-1.5">
            {assessment.practicalFit.notes.map((note) => (
              <li key={note} className="text-sm leading-relaxed text-ink-soft">· {note}</li>
            ))}
          </ul>
          <p className="text-xs text-ink-faint">
            {trial.sites.length} location{trial.sites.length === 1 ? "" : "s"} listed in the record.
          </p>
        </Card>
      </section>

      {/* ---------------------------------------------------------- questions */}
      <section aria-labelledby="questions-heading">
        <SectionHeading
          id="questions-heading"
          hint="Your questions travel with you. They stay here until someone answers them, and you can send them with an inquiry."
        >
          My questions for the study team
        </SectionHeading>

        <Card className="space-y-3 p-4">
          <form action={addQuestionAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="trialId" value={trial.id} />
            <label className="sr-only" htmlFor="question-text">Add a question</label>
            <input
              id="question-text" name="text" required
              placeholder="e.g. Is parking covered at the study site?"
              className="min-h-11 flex-1 rounded-lg border border-rule bg-paper-raised px-3.5 text-sm text-ink placeholder:text-ink-faint"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-teal bg-teal px-4 text-sm font-medium text-white hover:bg-teal-deep"
            >
              Add question
            </button>
          </form>

          {burden.openQuestions.length ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Suggested, from what this record does not say
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...burden.openQuestions, ...brief.suggestedQuestions]
                  .filter((q, i, all) => all.indexOf(q) === i)
                  .filter((q) => !questions.some((existing) => existing.text === q))
                  .slice(0, 6)
                  .map((question) => (
                    <form key={question} action={addQuestionAction}>
                      <input type="hidden" name="trialId" value={trial.id} />
                      <input type="hidden" name="text" value={question} />
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center rounded-full border border-rule bg-paper-sunken px-3.5 py-2 text-left text-xs leading-snug text-ink-soft hover:border-teal hover:text-teal"
                      >
                        + {question}
                      </button>
                    </form>
                  ))}
              </div>
            </div>
          ) : null}

          {questions.length ? (
            <ul className="space-y-2">
              {questions.map((question) => (
                <li key={question.id} className="rounded-lg border border-rule p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{question.text}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {question.category === "clinical"
                          ? "Clinical — will be routed to qualified study staff"
                          : question.category}
                        {" · "}
                        {question.state.replace(/_/g, " ")}
                      </p>
                    </div>
                    {question.state === "open" ? (
                      <form action={removeQuestionAction}>
                        <input type="hidden" name="questionId" value={question.id} />
                        <input type="hidden" name="trialId" value={trial.id} />
                        <button type="submit" className="min-h-11 px-2 text-xs text-ink-faint hover:text-clay">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                  {question.answer ? (
                    <div className="mt-2 rounded-lg border border-teal/30 bg-teal-soft p-2.5">
                      <p className="text-sm leading-relaxed text-teal-deep">{question.answer}</p>
                      <p className="mt-1 text-[11px] text-teal-deep/70">
                        {question.answeredBy}
                        {question.answerCitation ? ` · ${question.answerCitation}` : ""}
                      </p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">
              You have not saved any questions for this study yet.
            </p>
          )}
        </Card>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <LinkButton href={`/inquiry/new/${trial.id}`} className="flex-1">
          Prepare an inquiry →
        </LinkButton>
        <LinkButton href="/explore" variant="secondary" className="flex-1">
          Keep looking
        </LinkButton>
      </div>

      <Note>
        Preparing an inquiry does not enrol you and does not commit you to anything. You choose
        exactly what is shared, and you can stop at any point without losing what you have saved.
      </Note>
    </div>
  );
}

/** One status group of criteria, each with its verbatim source text. */
function CriterionGroup({
  title, description, items, collapsed = false,
}: {
  title: string; description: string; items: CriterionAssessment[];
  trial: string; collapsed?: boolean;
}) {
  if (items.length === 0) return null;

  const body = (
    <>
      <p className="mb-2.5 text-sm leading-relaxed text-ink-soft">{description}</p>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.criterionId} className="rounded-lg border border-rule p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusChip status={item.status} />
              <span className="text-[11px] uppercase tracking-wide text-ink-faint">
                {item.role === "exclusion" ? "Exclusion criterion" : item.role === "inclusion" ? "Inclusion criterion" : "Criterion"}
                {item.logic === "any_of" ? " · lists alternatives" : ""}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-ink-soft">{item.rationale}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-teal hover:underline">
                Show the exact wording from the record
              </summary>
              <blockquote className="source-quote mt-1.5">{item.evidenceSpan}</blockquote>
              <p className="mt-1 text-[11px] text-ink-faint">
                {item.sourceStart >= 0
                  ? `Eligibility criteria, characters ${item.sourceStart}–${item.sourceEnd} of the record`
                  : "Structured eligibility field of the record"}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </>
  );

  return (
    <Card className="p-4">
      {collapsed ? (
        <details>
          <summary className="cursor-pointer list-none">
            <h3 className="inline text-sm font-semibold text-ink">
              {title} ({items.length}) <span className="text-xs font-normal text-teal">show</span>
            </h3>
          </summary>
          <div className="mt-2.5">{body}</div>
        </details>
      ) : (
        <>
          <h3 className="mb-1 text-sm font-semibold text-ink">{title} ({items.length})</h3>
          {body}
        </>
      )}
    </Card>
  );
}
