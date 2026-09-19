import Link from "next/link";
import { Card, Empty, LinkButton, Note, SectionHeading } from "@/components/ui";
import { getTrial, listEnrollments, listInquiriesForParticipant, listMilestones, listQuestions } from "@/lib/repo";
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
      <header>
        <p className="text-sm text-ink-soft">
          {new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {participant.displayName.replace(/\s*\(synthetic\)$/, "")}
        </h1>
      </header>

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

      {upcoming.length === 0 && awaiting.length === 0 && answered.length === 0 ? (
        <section>
          <SectionHeading hint="Start by seeing which studies might be worth a conversation.">
            Where to begin
          </SectionHeading>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href="/explore" className="flex-1">Explore options</LinkButton>
            <LinkButton href="/passport" variant="secondary" className="flex-1">
              Check my passport
            </LinkButton>
          </div>
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
