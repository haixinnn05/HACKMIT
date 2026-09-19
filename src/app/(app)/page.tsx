import Link from "next/link";
import { Card, Empty, Note, SectionHeading } from "@/components/ui";
import { getTrial, listEnrollments, listInquiriesForParticipant, listMilestones, listQuestions, listSavedTrialIds } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { requestNow } from "@/lib/clock";

export const dynamic = "force-dynamic";

/**
 * Home.
 *
 * What is actually happening, in date order: visits coming up for studies the
 * person agreed to join, and inquiries waiting on someone. Dates come only from
 * a confirmed visit schedule — a study with no published schedule produces no
 * calendar entries rather than invented ones.
 */
export default async function HomePage() {
  const participant = await getActiveParticipant();
  // One instant for the whole page, so "in 3 days" cannot disagree with the date beside it.
  const now = requestNow();
  const enrollments = listEnrollments(participant.id);
  const inquiries = listInquiriesForParticipant(participant.id);
  const milestones = listMilestones(participant.id);
  const savedTrialIds = listSavedTrialIds(participant.id);
  const participantQuestions = listQuestions({ participantId: participant.id });
  const recordedFacts = participant.clinicalFacts.filter((fact) => fact.value).length;

  const today = new Date(now).toISOString().slice(0, 10);
  const upcoming = enrollments
    .filter((entry) => entry.status === "participating")
    .flatMap((entry) =>
      entry.visits.map((visit) => ({ ...visit, trialId: entry.trialId }))
    )
    .filter((visit) => visit.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const awaiting = inquiries.filter((inquiry) =>
    ["shared", "acknowledged", "needs_information"].includes(inquiry.state)
  );
  const answered = inquiries.filter((inquiry) => inquiry.state === "answered");

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-rule bg-white px-5 py-6 shadow-[0_12px_34px_rgba(23,23,32,0.07)] sm:px-7 sm:py-8">
        <div aria-hidden className="absolute -right-9 -top-12 size-40 rounded-full border-[22px] border-teal-soft" />
        <div aria-hidden className="absolute -bottom-10 right-28 size-20 rotate-12 rounded-2xl bg-coral-soft" />
        <p className="relative inline-flex rounded-full bg-lemon-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber">
          Your trial journey
        </p>
        <p className="relative mt-4 text-sm font-medium text-ink-faint">
          {new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="relative mt-1 text-3xl font-bold tracking-[-0.04em] text-ink sm:text-4xl">
          Welcome, {participant.displayName.replace(/\s*\(synthetic\)$/, "")}
        </h1>
        <p className="relative mt-2 max-w-lg text-sm leading-relaxed text-ink-soft">
          Take this one step at a time. Your questions, options, and next steps are all in one place.
        </p>
        <Link
          href="/explore"
          className="relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal px-5 py-2 text-sm font-bold text-white shadow-[0_7px_18px_rgba(100,55,245,0.22)] transition-colors hover:bg-teal-deep"
        >
          Find clinical trials
          <span aria-hidden>→</span>
        </Link>
      </header>

      <JourneyRoadmap
        recordedFacts={recordedFacts}
        totalFacts={participant.clinicalFacts.length}
        savedCount={savedTrialIds.length}
        openQuestionCount={participantQuestions.filter((question) => !question.answer).length}
        inquiryCount={inquiries.length}
      />

      {answered.length ? (
        <section aria-labelledby="replies-heading">
          <SectionHeading id="replies-heading">You have a reply</SectionHeading>
          <ul className="space-y-2">
            {answered.map((inquiry) => {
              const trial = getTrial(inquiry.trialId);
              const questions = listQuestions({ inquiryId: inquiry.id }).filter((q) => q.answer);
              return (
                <Card as="li" key={inquiry.id} className="border-teal/40 bg-teal-soft">
                  <Link href={`/inquiry/${inquiry.id}`} className="block p-4">
                    <p className="text-sm font-medium text-teal-deep">
                      {trial?.briefTitle ?? inquiry.trialId}
                    </p>
                    {questions[0] ? (
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-teal-deep/85">
                        “{questions[0].answer}”
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-teal-deep/70">Read the full answer →</p>
                  </Link>
                </Card>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="calendar-heading">
        <SectionHeading
          id="calendar-heading"
          hint="Only studies you have said yes to, using dates from a confirmed schedule."
        >
          What is coming up
        </SectionHeading>

        {upcoming.length === 0 ? (
          <Empty title="Nothing scheduled">
            When you agree to take part in a study that has a confirmed visit schedule, its
            visits appear here.
          </Empty>
        ) : (
          <ol className="space-y-2">
            {upcoming.map((visit, index) => {
              const trial = getTrial(visit.trialId);
              const date = new Date(`${visit.date}T09:00:00`);
              const days = Math.round((date.getTime() - now) / 86400000);
              return (
                <Card as="li" key={`${visit.trialId}-${index}`} className="p-4">
                  <div className="flex items-start gap-3.5">
                    <div className="shrink-0 rounded-lg border border-rule bg-paper-sunken px-2.5 py-1.5 text-center">
                      <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                        {date.toLocaleDateString(undefined, { month: "short" })}
                      </p>
                      <p className="text-lg font-semibold leading-none text-ink">{date.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{visit.name}</p>
                      <p className="text-sm text-ink-soft">{trial?.briefTitle ?? visit.trialId}</p>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        About {visit.onSiteHours}h on site
                        {visit.location ? ` · ${visit.location}` : ""} ·{" "}
                        {days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </ol>
        )}
      </section>

      {awaiting.length ? (
        <section aria-labelledby="waiting-heading">
          <SectionHeading id="waiting-heading" hint="Sites answer on their own schedule. There is nothing you need to do.">
            Waiting on someone
          </SectionHeading>
          <ul className="space-y-2">
            {awaiting.map((inquiry) => {
              const trial = getTrial(inquiry.trialId);
              return (
                <Card as="li" key={inquiry.id}>
                  <Link href={`/inquiry/${inquiry.id}`} className="flex items-center justify-between gap-3 p-4">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">
                        {trial?.briefTitle ?? inquiry.trialId}
                      </span>
                      <span className="block text-xs text-ink-soft">
                        {inquiry.state === "needs_information"
                          ? "The site has asked you for something"
                          : inquiry.state === "acknowledged"
                            ? "A coordinator has opened it"
                            : "Shared, not yet opened"}
                      </span>
                    </span>
                    <span aria-hidden className="text-teal">→</span>
                  </Link>
                </Card>
              );
            })}
          </ul>
        </section>
      ) : null}

      {milestones.length ? (
        <section aria-labelledby="stamps-heading">
          <SectionHeading
            id="stamps-heading"
            hint="Private to you. A record of what you did, not a score, and never a reward for joining or staying in a study."
          >
            Your passport stamps
          </SectionHeading>
          <Card className="flex flex-wrap gap-2 p-4">
            {milestones.map((milestone, index) => (
              <span
                key={milestone.id}
                style={{ animationDelay: `${index * 55}ms` }}
                className="animate-stamp inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-soft px-3 py-1.5 text-xs font-medium text-teal-deep"
              >
                <span aria-hidden>◉</span>
                {milestone.label}
              </span>
            ))}
          </Card>
        </section>
      ) : null}

      <Note>
        This app helps you prepare a conversation. It cannot tell you whether you qualify for a
        study, and taking part in research is always decided with a study&rsquo;s own team.
      </Note>
    </div>
  );
}

function JourneyRoadmap({
  recordedFacts,
  totalFacts,
  savedCount,
  openQuestionCount,
  inquiryCount,
}: {
  recordedFacts: number;
  totalFacts: number;
  savedCount: number;
  openQuestionCount: number;
  inquiryCount: number;
}) {
  const steps = [
    {
      number: "01",
      title: "Build your passport",
      detail: `${recordedFacts} of ${totalFacts} clinical facts recorded`,
      href: "/passport",
      action: "Review profile",
      marker: "bg-teal text-white",
      accent: "border-l-teal",
    },
    {
      number: "02",
      title: "Find trials worth a conversation",
      detail: savedCount ? `${savedCount} option${savedCount === 1 ? "" : "s"} saved` : "Search the public registry snapshot",
      href: "/explore",
      action: "Explore trials",
      marker: "bg-blue text-white",
      accent: "border-l-blue",
    },
    {
      number: "03",
      title: "Prepare your questions",
      detail: openQuestionCount ? `${openQuestionCount} open question${openQuestionCount === 1 ? "" : "s"}` : "Save questions as you review each study",
      href: "/passport",
      action: "View questions",
      marker: "bg-coral text-white",
      accent: "border-l-coral",
    },
    {
      number: "04",
      title: "Choose what happens next",
      detail: inquiryCount ? `${inquiryCount} conversation${inquiryCount === 1 ? "" : "s"} in your inbox` : "Nothing is shared until you choose",
      href: inquiryCount ? "/coordinator" : "/about",
      action: inquiryCount ? "Open inbox" : "See how sharing works",
      marker: "bg-lemon text-ink",
      accent: "border-l-lemon",
    },
  ];

  return (
    <section aria-labelledby="roadmap-heading">
      <SectionHeading id="roadmap-heading" hint="A simple roadmap from learning to deciding. You can move back and forth at any time.">
        Your roadmap
      </SectionHeading>
      <ol className="roadmap-line ml-5 space-y-3 pl-8">
        {steps.map((step) => (
          <li key={step.number} className="relative">
            <span className={`absolute -left-[3.05rem] top-5 grid size-10 place-items-center rounded-full border-4 border-paper text-[11px] font-extrabold shadow-sm ${step.marker}`}>
              {step.number}
            </span>
            <Card className={`overflow-hidden border-l-4 ${step.accent}`}>
              <Link href={step.href} className="group flex min-h-24 items-center justify-between gap-4 p-4 sm:p-5">
                <span className="min-w-0">
                  <span className="block text-base font-bold tracking-[-0.02em] text-ink">{step.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{step.detail}</span>
                  <span className="mt-2 block text-xs font-bold text-teal">{step.action}</span>
                </span>
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-paper-sunken text-lg text-ink transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
