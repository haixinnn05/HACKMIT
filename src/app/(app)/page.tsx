import Link from "next/link";
import { Bell } from "@phosphor-icons/react/dist/ssr";
import { Hills, MozaicLockup } from "@/components/Brand";
import { JourneyMap, type JourneyStop } from "@/components/JourneyMap";
import { requestNow } from "@/lib/clock";
import {
  getTrial, isInquiryUnread, listEnrollments, listInquiriesForParticipant, listTodos,
} from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Home is a journey map. Before a study is joined it is two stops — profile,
 * then find a trial. After enrollment it becomes that study's path: remaining
 * prep, then each visit, winding top to bottom.
 */
export default async function HomePage() {
  const participant = await getActiveParticipant();
  const now = requestNow();
  const firstName = participant.displayName.replace(/\s*\(synthetic\)$/, "").split(" ")[0];
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const inquiries = listInquiriesForParticipant(participant.id);
  const unread = inquiries.filter(isInquiryUnread);
  const enrollment = listEnrollments(participant.id).find((entry) => entry.status === "participating");
  const trial = enrollment ? getTrial(enrollment.trialId) : null;
  const today = new Date(now).toISOString().slice(0, 10);

  const factsRecorded = participant.clinicalFacts.filter((f) => f.provenance === "self_reported" && f.value).length;
  const profileDone = Boolean(participant.condition) && factsRecorded > 0;

  let stops: JourneyStop[];
  if (enrollment) {
    const todos = listTodos(participant.id).filter((todo) => todo.trialId === enrollment.trialId);
    const openTodos = todos.filter((todo) => !todo.done);
    stops = [];
    if (todos.length) {
      stops.push({
        id: "prep",
        title: "Get ready",
        sub: openTodos.length ? `${openTodos.length} to do` : undefined,
        href: "/timeline",
        done: openTodos.length === 0,
      });
    }
    for (const [index, visit] of enrollment.visits.entries()) {
      stops.push({
        id: `visit-${enrollment.trialId}-${index}`,
        title: visit.name,
        sub: new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", {
          weekday: "short", month: "short", day: "numeric",
        }),
        href: `/timeline#visit-${enrollment.trialId}-${index}`,
        done: visit.date < today,
      });
    }
    if (stops.length === 0) {
      stops = [{
        id: "enrolled",
        title: "Taking part",
        href: `/trial/${enrollment.trialId}`,
        done: false,
      }];
    }
  } else {
    stops = [
      {
        id: "profile",
        title: "Profile",
        href: "/profile/edit",
        done: profileDone,
      },
      {
        id: "find",
        title: "Find a trial",
        href: "/explore",
        done: false,
      },
    ];
  }

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
        <JourneyMap stops={stops} />
      </div>
    </div>
  );
}
