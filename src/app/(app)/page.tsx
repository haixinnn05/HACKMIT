import Link from "next/link";
import {
  ArrowRight, Bell, CalendarCheck, ChatCircleDots, Check, FileText, Leaf,
} from "@phosphor-icons/react/dist/ssr";
import { Hills, MozaicLockup } from "@/components/Brand";
import { Avatar, Card, LinkButton, SectionHeading } from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import { requestNow } from "@/lib/clock";
import {
  getPersonalNote, getTrial, isInquiryUnread, listEnrollments, listInquiriesForParticipant,
  listMilestones, listSavedTrialIds,
} from "@/lib/repo";
import { searchForProfile } from "@/lib/search";
import { redirect } from "next/navigation";
import { getActiveParticipant, getRole, hasChosenPersona } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Home: where you are, and the one thing to do next.
 *
 * Progress is derived from what the person has actually done rather than stored
 * as flags, so the path repairs itself if they go back and change something.
 * The last step counts any recorded decision, including "not interested":
 * deciding against a study completes the journey just as much as joining one.
 */
export default async function HomePage() {
  // A first-time visitor picks a face. Anyone who already has one goes straight in.
  if (!(await getRole()) && !(await hasChosenPersona())) redirect("/welcome");

  const participant = await getActiveParticipant();
  const now = requestNow();
  const firstName = participant.displayName.split(" ")[0];
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const saved = listSavedTrialIds(participant.id);
  const milestones = listMilestones(participant.id);
  const inquiries = listInquiriesForParticipant(participant.id);
  const enrollments = listEnrollments(participant.id);
  const reviewed = milestones.some((m) => m.kind === "reviewed_overview");
  const note = getPersonalNote(participant.id);
  const factsRecorded = participant.clinicalFacts.filter((f) => f.provenance === "self_reported" && f.value).length;

  const steps = [
    { label: "Profile complete", done: Boolean(participant.condition) && factsRecorded > 0 },
    { label: "Explore trials", done: saved.length > 0 || reviewed },
    { label: "Review options", done: reviewed },
    { label: "Talk to your care team", done: inquiries.length > 0 },
    { label: "Take the next step", done: enrollments.length > 0 },
  ];
  const completed = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);

  // Options worth a look: anything the rules did not flag as a likely conflict.
  const hits = searchForProfile(participant).hits;
  const worthReviewing = hits.filter((hit) => assessTrial(hit.trial, participant).overall !== "likely_conflict").length;

  const NEXT: Record<number, { title: string; body: string; cta: string; href: string }> = {
    0: { title: "Finish your profile", body: "A few facts about your situation let us compare studies against what you know.", cta: "Open My Profile", href: "/profile/edit" },
    1: { title: `Review ${worthReviewing} potential trial ${worthReviewing === 1 ? "option" : "options"}`, body: "Studies from the public registry that may be worth discussing with your care team.", cta: "View Trials", href: "/explore" },
    2: { title: "Read one study closely", body: "Open a study to see what it asks for, what is still unknown, and what taking part involves.", cta: "View Trials", href: "/explore" },
    3: { title: "Prepare your first inquiry", body: "Review exactly what you would share, then send your questions to a study team.", cta: saved[0] ? "Review Inquiry" : "View Trials", href: saved[0] ? `/inquiry/new/${saved[0]}` : "/explore" },
    4: { title: "Decide what is right for you", body: "Joining, waiting and saying no are all good outcomes. Nothing you saved is lost either way.", cta: "Open Inbox", href: "/inbox" },
  };
  const next = nextIndex === -1 ? null : NEXT[nextIndex];

  const today = new Date(now).toISOString().slice(0, 10);
  const upcoming = enrollments
    .filter((entry) => entry.status === "participating")
    .flatMap((entry) => entry.visits.map((visit) => ({ ...visit, trialId: entry.trialId })))
    .filter((visit) => visit.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const unread = inquiries.filter(isInquiryUnread);

  return (
    <div className="space-y-5">
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
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">{greeting},</p>
            <h1 className="text-[1.6rem] font-bold leading-tight tracking-[-0.02em] text-ink">{firstName}</h1>
            {/* Their own words say more than ours, so the stock line yields to them. */}
            {note ? null : (
              <p className="mt-1 max-w-[13.5rem] text-[12.5px] leading-relaxed text-ink-soft">
                You&rsquo;re taking this one step at a time, and that&rsquo;s exactly right.
              </p>
            )}
            {note ? (
              <p className="mt-2 inline-block max-w-[15rem] rounded-[14px] rounded-bl-[4px] bg-surface/85 px-3 py-2 text-[12px] leading-snug text-ink shadow-[0_2px_8px_rgba(14,13,99,0.06)]">
                &ldquo;{note}&rdquo;
              </p>
            ) : null}
          </div>
          <Avatar name={participant.displayName} size="size-16 text-lg" />
        </div>
      </header>

      {unread.length ? (
        <Card className="relative -mt-10 border-iris/20">
          <Link href={`/inquiry/${unread[0].id}`} className="press flex items-center gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-iris-soft text-iris"><ChatCircleDots size={22} weight="fill" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">You have a reply</span>
              <span className="block truncate text-[12.5px] text-ink-soft">{getTrial(unread[0].trialId)?.briefTitle ?? unread[0].trialId}</span>
            </span>
            <ArrowRight size={18} weight="bold" className="text-iris" />
          </Link>
        </Card>
      ) : null}

      {upcoming.length ? (
        <Card className={unread.length ? "" : "relative -mt-10"}>
          <Link href="/timeline" className="press flex items-center gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-mint-soft text-mint"><CalendarCheck size={22} weight="fill" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">{upcoming[0].name}</span>
              <span className="block truncate text-[12.5px] text-ink-soft">
                {new Date(`${upcoming[0].date}T09:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                {upcoming.length > 1 ? `, and ${upcoming.length - 1} more` : ""}
              </span>
            </span>
            <ArrowRight size={18} weight="bold" className="text-iris" />
          </Link>
        </Card>
      ) : null}

      <section aria-labelledby="journey-heading">
        <SectionHeading id="journey-heading" trailing={`${completed} of ${steps.length} completed`}>Your Journey</SectionHeading>
        {/*
          Each connector runs only between two circle edges, never underneath a
          circle. Three states, each readable without colour: a solid segment is
          travelled, a solid-to-faded segment leads into the current step, and a
          dashed segment is still ahead.
        */}
        <ol className="grid grid-cols-5">
          {steps.map((step, index) => {
            const current = index === nextIndex;
            const travelled = index > 0 && steps[index - 1].done && step.done;
            const arriving = index > 0 && steps[index - 1].done && current;
            return (
              <li key={step.label} className="relative flex flex-col items-center text-center" aria-current={current ? "step" : undefined}>
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={`absolute top-[17px] h-[3px] rounded-full ${
                      travelled ? "bg-iris"
                        : arriving ? "bg-gradient-to-r from-iris to-iris/25"
                        : "bg-[repeating-linear-gradient(90deg,var(--color-rule-strong)_0_5px,transparent_5px_10px)]"
                    }`}
                    // The current step's ring makes it 5px wider, so its two
                    // neighbouring segments pull back by the same amount.
                    style={{
                      left: `calc(-50% + ${index - 1 === nextIndex ? 27 : 22}px)`,
                      right: `calc(50% + ${current ? 27 : 22}px)`,
                    }}
                  />
                ) : null}

                <span
                  className={`relative grid size-9 place-items-center rounded-full ${
                    step.done ? "bg-iris text-white"
                      : current ? "bg-surface ring-2 ring-iris ring-offset-[3px] ring-offset-iris-soft"
                      : "border-2 border-dashed border-rule-strong bg-surface text-ink-faint"
                  }`}
                >
                  {step.done ? <Check size={16} weight="bold" />
                    : current ? <span className="size-2.5 rounded-full bg-iris" />
                    : <span className="text-[12px] font-bold">{index + 1}</span>}
                </span>

                <span className={`mt-2 px-0.5 text-[10.5px] leading-tight ${
                  current ? "font-bold text-iris-deep" : step.done ? "font-semibold text-ink" : "font-medium text-ink-faint"
                }`}>
                  {step.label}
                  <span className="sr-only">{step.done ? ", done" : current ? ", up next" : ", not started"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {next ? (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris"><FileText size={22} /></span>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-ink-soft">Your next step</p>
              <p className="text-[15px] font-bold leading-snug text-ink">{next.title}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{next.body}</p>
            </div>
          </div>
          <LinkButton href={next.href} className="mt-3.5 w-full">
            {next.cta} <ArrowRight size={16} weight="bold" />
          </LinkButton>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-[15px] font-bold text-ink">You have been through every step</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
            Whatever you decided, your saved studies, questions and answers stay here.
          </p>
        </Card>
      )}

      <div className="flex items-start gap-3 rounded-[20px] bg-lavender px-4 py-4">
        <Leaf size={26} className="mt-0.5 shrink-0 text-iris" />
        <div>
          <p className="text-[14px] font-bold text-ink">You&rsquo;re not alone in this.</p>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            We help you get ready for the conversation. Whether a study is right for you is
            something you and its team decide together.
          </p>
        </div>
      </div>
    </div>
  );
}
