import Link from "next/link";
import { ArrowRight, CalendarCheck, CaretRight, ChatCircleDots, ClockCounterClockwise, Hourglass, Tray, UserFocus } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Card, Empty, Pill, SectionHeading } from "@/components/ui";
import { requestNow } from "@/lib/clock";
import { isAnswered, SITE_STAFF } from "@/lib/questions";
import { getParticipant, getTrial, listEnrollments, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";
import { STAFF } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Today: what needs a person's attention, in the order it needs it.
 *
 * Every figure here is counted from the inquiries currently authorised for this
 * site. Nothing is predicted. In particular there is no dropout-risk or
 * likelihood-to-enrol score: ranking people by predicted behaviour is the kind
 * of opaque judgement this product refuses to make. Ordering is by what was
 * asked and how long it has waited.
 */
export default function ClinicToday() {
  const now = requestNow();
  const inquiries = listInquiriesForCoordinator();
  const questions = inquiries.flatMap((inquiry) => listQuestions({ inquiryId: inquiry.id }).map((question) => ({ question, inquiry })));
  const open = questions.filter(({ question }) => !isAnswered(question));

  const needsReview = inquiries.filter((i) => ["shared", "acknowledged"].includes(i.state));
  const waitingOnPatient = inquiries.filter((i) => i.state === "needs_information");
  const clinicalUnowned = open.filter(({ question }) => question.category === "clinical" && question.assignedTo !== "investigator");
  const reopened = open.filter(({ question }) => Boolean(question.answer));

  // Visits in the next seven days, for people whose inquiry is still authorised.
  const soon = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const visits = [...new Set(inquiries.map((i) => i.participantId))].flatMap((participantId) =>
    listEnrollments(participantId).filter((e) => e.status === "participating").flatMap((e) =>
      e.visits.filter((v) => v.date >= today && v.date <= soon).map((visit) => ({ visit, participantId, trialId: e.trialId }))));

  // A measured figure, not a target: time from an inquiry arriving to its first sent answer.
  const responseMinutes = inquiries.map((inquiry) => {
    const first = listQuestions({ inquiryId: inquiry.id }).map((q) => q.answeredAt).filter(Boolean).sort()[0];
    return first ? (new Date(first).getTime() - new Date(inquiry.createdAt).getTime()) / 60000 : null;
  }).filter((m): m is number => m != null).sort((a, b) => a - b);
  const median = responseMinutes.length ? responseMinutes[Math.floor(responseMinutes.length / 2)] : null;

  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const tiles = [
    { label: "Need review", value: needsReview.length, href: "/clinic/inbox?tab=review", icon: <Tray size={20} /> },
    { label: "Open questions", value: open.length, href: "/clinic/inbox", icon: <ChatCircleDots size={20} /> },
    { label: "Waiting on patient", value: waitingOnPatient.length, href: "/clinic/inbox?tab=replied", icon: <Hourglass size={20} /> },
    { label: "Visits this week", value: visits.length, href: "/clinic/patients", icon: <CalendarCheck size={20} /> },
  ];

  // Ordered by what was asked and how long it has waited. Never by a prediction about the person.
  const queue = [
    ...reopened.map(({ question, inquiry }) => ({ inquiry, reason: "Reopened: the answer did not settle it", tone: "peach" as const, since: question.createdAt })),
    ...clinicalUnowned.map(({ question, inquiry }) => ({ inquiry, reason: "Clinical question needs an investigator", tone: "blush" as const, since: question.createdAt })),
    ...needsReview.map((inquiry) => ({ inquiry, reason: inquiry.state === "shared" ? "New, not opened yet" : "Opened, no reply yet", tone: "iris" as const, since: inquiry.createdAt })),
  ].filter((item, index, all) => all.findIndex((other) => other.inquiry.id === item.inquiry.id) === index)
    .sort((a, b) => a.since.localeCompare(b.since)).slice(0, 5);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[14px] font-semibold text-ink-soft">{greeting}, {STAFF.name.split(" ")[0]}</p>
        <h1 className="text-[1.5rem] font-bold leading-tight tracking-[-0.02em] text-ink">Today</h1>
      </header>

      <ul className="grid grid-cols-2 gap-2.5">
        {tiles.map((tile) => (
          <Card as="li" key={tile.label}>
            <Link href={tile.href} className="block p-3.5">
              <span className="flex items-center justify-between text-iris">{tile.icon}<CaretRight size={14} weight="bold" className="text-ink-faint" /></span>
              <span className="mt-1.5 block text-[1.6rem] font-bold leading-none tracking-[-0.02em] text-ink">{tile.value}</span>
              <span className="mt-1 block text-[12px] font-semibold text-ink-soft">{tile.label}</span>
            </Link>
          </Card>
        ))}
      </ul>

      <section aria-labelledby="queue-heading">
        <SectionHeading id="queue-heading" hint="Ordered by what was asked and how long it has waited. People are never ranked by a prediction about them.">
          Needs you first
        </SectionHeading>
        {queue.length === 0 ? (
          <Empty title="Nothing is waiting on you" icon={<Tray size={22} />}>New inquiries appear here as participants share them.</Empty>
        ) : (
          <ul className="space-y-2.5">
            {queue.map(({ inquiry, reason, tone, since }) => {
              const participant = getParticipant(inquiry.participantId);
              const name = (participant?.displayName ?? "Participant").replace(/\s*\(synthetic\)$/, "");
              const hours = Math.max(0, Math.round((now - new Date(since).getTime()) / 3600000));
              return (
                <Card as="li" key={inquiry.id}>
                  <Link href={`/clinic/inbox/${inquiry.id}`} className="flex items-center gap-3 p-3.5">
                    <Avatar name={name} size="size-11 text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">{name}</span>
                      <span className="block truncate text-[12px] text-ink-soft">{getTrial(inquiry.trialId)?.briefTitle ?? inquiry.trialId}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Pill tone={tone}>{reason}</Pill>
                        <span className="text-[11px] text-ink-faint">waiting {hours < 1 ? "under an hour" : hours < 48 ? `${hours}h` : `${Math.round(hours / 24)} days`}</span>
                      </span>
                    </span>
                    <ArrowRight size={16} weight="bold" className="shrink-0 text-iris" />
                  </Link>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      {open.length ? (
        <section aria-labelledby="owners-heading">
          <SectionHeading id="owners-heading">Open questions by owner</SectionHeading>
          <Card className="px-4">
            {[...SITE_STAFF, { id: null, label: "No owner yet" }].map((staff) => {
              const count = open.filter(({ question }) => (question.assignedTo ?? null) === staff.id).length;
              return count ? (
                <div key={staff.label} className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0">
                  <span className="flex items-center gap-2 text-[13px] text-ink"><UserFocus size={16} className="text-iris" />{staff.label}</span>
                  <span className="text-[14px] font-bold text-ink">{count}</span>
                </div>
              ) : null;
            })}
          </Card>
        </section>
      ) : null}

      {visits.length ? (
        <section aria-labelledby="visits-heading">
          <SectionHeading id="visits-heading">Visits in the next 7 days</SectionHeading>
          <Card className="px-4">
            {visits.map(({ visit, participantId }, index) => (
              <Link key={index} href={`/clinic/patients/${participantId}`} className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-bold text-ink">{(getParticipant(participantId)?.displayName ?? "").replace(/\s*\(synthetic\)$/, "")}</span>
                  <span className="block text-[12px] text-ink-soft">{visit.name}, about {visit.onSiteHours}h</span>
                </span>
                <span className="shrink-0 text-[12px] font-semibold text-ink-soft">{new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}

      <Card className="flex items-start gap-3 p-4">
        <ClockCounterClockwise size={22} className="mt-0.5 shrink-0 text-iris" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-bold text-ink">
            {median == null ? "No replies sent yet" : `Median time to first reply: ${median < 60 ? `${Math.max(1, Math.round(median))} min` : `${(median / 60).toFixed(1)} h`}`}
          </p>
          <p className="text-[12px] leading-relaxed text-ink-soft">
            {median == null ? "Once answers are sent, the measured response time appears here." : `Measured across ${responseMinutes.length} answered ${responseMinutes.length === 1 ? "inquiry" : "inquiries"} in this demo. It is a count, not a target.`}
          </p>
          <Link href="/clinic/activity" className="mt-1 inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-iris">Open the activity log <ArrowRight size={13} weight="bold" /></Link>
        </div>
      </Card>
    </div>
  );
}
