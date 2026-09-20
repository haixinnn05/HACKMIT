import Link from "next/link";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import { Hills, MozaicLockup } from "@/components/Brand";
import { JourneyMap, type JourneyStop } from "@/components/JourneyMap";
import { requestNow } from "@/lib/clock";
import {
  getParticipatingEnrollment, getTrial, isInquiryUnread, listInquiriesForParticipant, listTodos, type Todo,
} from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import type { EnrollmentEntry, Inquiry, Trial } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Home is a journey map. Before a study is applied to it is two stops — profile,
 * then find a trial. After applying, the path starts at 0, waiting for the
 * research team to approve, then get-ready and visits. Only one study can be
 * underway at a time.
 */
export default async function HomePage() {
  const participant = await getActiveParticipant();
  const now = requestNow();
  const firstName = participant.displayName.replace(/\s*\(synthetic\)$/, "").split(" ")[0];
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const inquiries = listInquiriesForParticipant(participant.id);
  const unread = inquiries.filter(isInquiryUnread);
  const enrollment = getParticipatingEnrollment(participant.id);
  const pending = !enrollment
    ? inquiries.find((inquiry) => inquiry.state !== "closed" && inquiry.state !== "draft") ?? null
    : inquiries.find((inquiry) => inquiry.trialId === enrollment.trialId && inquiry.state !== "closed") ?? null;
  const trial = getTrial((enrollment ?? pending)?.trialId ?? "");
  const today = new Date(now).toISOString().slice(0, 10);

  const factsRecorded = participant.clinicalFacts.filter((f) => f.provenance === "self_reported" && f.value).length;
  const profileDone = Boolean(participant.condition) && factsRecorded > 0;

  const studyStops = trial
    ? studyJourney({
        trial,
        enrollment,
        inquiry: pending,
        todos: listTodos(participant.id).filter((todo) => todo.trialId === trial.id),
        today,
      })
    : [];

  const introStops: JourneyStop[] = [
    { id: "profile", title: "Profile", href: "/profile/edit", done: profileDone },
    { id: "find", title: "Find a trial", href: "/explore", done: false },
  ];

  return (
    <div>
      <header className="relative -mx-5 -mt-5 overflow-hidden bg-lavender px-5 pb-12 pt-3">
        <Hills />
        <div className="relative -mt-1 mb-2 flex items-center justify-between">
          <MozaicLockup className="h-7 w-auto" />
          <Link href="/inbox" className="relative -mr-2 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <Bell size={22} />
            {unread.length ? <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-lavender bg-blush" /> : null}
            <span className="sr-only">Inbox{unread.length ? `, ${unread.length} new` : ""}</span>
          </Link>
        </div>
        <div className="relative">
          <p className="text-[15px] font-semibold text-ink">{greeting},</p>
          <h1 className="text-[1.6rem] font-bold leading-tight tracking-[-0.02em] text-ink">{firstName}</h1>
        </div>
      </header>

      <div className="relative mt-5 space-y-4 pb-4">
        {trial ? (
          <h2 className="px-1 text-[1.05rem] font-bold leading-snug tracking-[-0.02em] text-ink">
            {trial.briefTitle}
          </h2>
        ) : null}
        <JourneyMap stops={studyStops.length ? studyStops : introStops} startAt={studyStops.length ? 0 : 1} />
      </div>
    </div>
  );
}

function studyJourney(opts: {
  trial: Trial;
  enrollment: EnrollmentEntry | null;
  inquiry: Inquiry | null;
  todos: Todo[];
  today: string;
}): JourneyStop[] {
  const { trial, enrollment, inquiry, todos, today } = opts;
  const approved = inquiry?.state === "approved";
  const openTodos = todos.filter((todo) => !todo.done);
  const approvalHref = inquiry ? `/inquiry/${inquiry.id}` : `/trial/${trial.id}`;

  const stops: JourneyStop[] = [
    {
      id: "approval",
      title: "Waiting for approval",
      sub: approved ? undefined : "The study team reviews this first",
      href: approvalHref,
      done: approved,
    },
    {
      id: "prep",
      title: "Get ready",
      sub: approved && openTodos.length ? `${openTodos.length} to do` : undefined,
      href: "/timeline",
      done: approved && openTodos.length === 0,
    },
  ];

  const dated = enrollment?.visits ?? [];
  if (dated.length) {
    for (const [index, visit] of dated.entries()) {
      stops.push({
        id: `visit-${trial.id}-${index}`,
        title: visit.name,
        sub: new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        }),
        href: `/timeline#visit-${trial.id}-${index}`,
        done: approved && visit.date < today,
      });
    }
    return stops;
  }

  for (const [index, visit] of (trial.visitSchedule?.visits ?? []).entries()) {
    stops.push({
      id: `plan-${index}`,
      title: visit.name,
      sub: approved ? "Date not confirmed" : undefined,
      href: `/trial/${trial.id}?tab=expect`,
      done: false,
    });
  }
  return stops;
}
