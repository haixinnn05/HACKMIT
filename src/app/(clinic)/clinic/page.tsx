import Link from "next/link";
import { ArrowRight, Tray } from "@phosphor-icons/react/dist/ssr";
import { Hills } from "@/components/Brand";
import { Avatar, Card, Empty, Pill, SectionHeading } from "@/components/ui";
import { requestNow } from "@/lib/clock";
import { isAnswered } from "@/lib/questions";
import { getParticipant, getTrial, listEnrollments, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";
import { STAFF } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Today: what needs a person's attention, in the order it needs it.
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

  const soon = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
  const today = new Date(now).toISOString().slice(0, 10);
  const visits = [...new Set(inquiries.map((i) => i.participantId))].flatMap((participantId) =>
    listEnrollments(participantId).filter((e) => e.status === "participating").flatMap((e) =>
      e.visits.filter((v) => v.date >= today && v.date <= soon).map((visit) => ({ visit, participantId, trialId: e.trialId }))));

  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const tiles = [
    { label: "Need review", value: needsReview.length, href: "/clinic/inbox?tab=review" },
    { label: "Open questions", value: open.length, href: "/clinic/inbox" },
    { label: "Waiting on patient", value: waitingOnPatient.length, href: "/clinic/inbox?tab=replied" },
    { label: "Visits this week", value: visits.length, href: "/clinic/patients" },
  ];

  const queue = [
    ...reopened.map(({ question, inquiry }) => ({ inquiry, reason: "Reopened", tone: "peach" as const, since: question.createdAt })),
    ...clinicalUnowned.map(({ question, inquiry }) => ({ inquiry, reason: "Needs investigator", tone: "blush" as const, since: question.createdAt })),
    ...needsReview.map((inquiry) => ({ inquiry, reason: inquiry.state === "shared" ? "New" : "Opened", tone: "iris" as const, since: inquiry.createdAt })),
  ].filter((item, index, all) => all.findIndex((other) => other.inquiry.id === item.inquiry.id) === index)
    .sort((a, b) => a.since.localeCompare(b.since)).slice(0, 5);

  return (
    <div>
      <header className="relative -mx-5 -mt-5 overflow-hidden bg-lavender px-5 pb-10 pt-4">
        <Hills />
        <div className="relative">
          <p className="text-[15px] font-semibold text-ink">{greeting},</p>
          <h1 className="text-[1.6rem] font-bold leading-tight tracking-[-0.02em] text-ink">{STAFF.name}</h1>
        </div>
      </header>

      <div className="relative mt-5 space-y-5">
        <ul className="grid grid-cols-2 gap-2.5">
          {tiles.map((tile) => (
            <Card as="li" key={tile.label}>
              <Link href={tile.href} className="press block p-3.5">
                <span className="block text-[1.55rem] font-bold leading-none tracking-[-0.02em] text-ink">{tile.value}</span>
                <span className="mt-1.5 block text-[12px] font-semibold text-ink-soft">{tile.label}</span>
              </Link>
            </Card>
          ))}
        </ul>

        <section aria-labelledby="queue-heading">
          <SectionHeading id="queue-heading">Needs you first</SectionHeading>
          {queue.length === 0 ? (
            <Empty title="You're all caught up" icon={<Tray size={22} />} />
          ) : (
            <ul className="space-y-2.5">
              {queue.map(({ inquiry, reason, tone, since }) => {
                const participant = getParticipant(inquiry.participantId);
                const name = (participant?.displayName ?? "Participant").replace(/\s*\(synthetic\)$/, "");
                const hours = Math.max(0, Math.round((now - new Date(since).getTime()) / 3600000));
                return (
                  <Card as="li" key={inquiry.id}>
                    <Link href={`/clinic/inbox/${inquiry.id}`} className="press flex items-center gap-3 p-3.5">
                      <Avatar name={name} size="size-11 text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-ink">{name}</span>
                        <span className="block truncate text-[12px] text-ink-soft">{getTrial(inquiry.trialId)?.briefTitle ?? inquiry.trialId}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Pill tone={tone}>{reason}</Pill>
                          <span className="text-[11px] text-ink-faint">{hours < 1 ? "just now" : hours < 48 ? `${hours}h` : `${Math.round(hours / 24)}d`}</span>
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

        {visits.length ? (
          <section aria-labelledby="visits-heading">
            <SectionHeading id="visits-heading">This week</SectionHeading>
            <Card className="px-4">
              {visits.map(({ visit, participantId }, index) => (
                <Link key={index} href={`/clinic/patients/${participantId}`} className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-bold text-ink">{(getParticipant(participantId)?.displayName ?? "").replace(/\s*\(synthetic\)$/, "")}</span>
                    <span className="block text-[12px] text-ink-soft">{visit.name}</span>
                  </span>
                  <span className="shrink-0 text-[12px] font-semibold text-ink-soft">{new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                </Link>
              ))}
            </Card>
          </section>
        ) : null}

        <p className="text-center">
          <Link href="/clinic/activity" className="inline-flex min-h-11 items-center text-[12.5px] font-bold text-iris">Activity log</Link>
        </p>
      </div>
    </div>
  );
}
