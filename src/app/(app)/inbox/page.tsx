import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { Empty, Pill, ScreenHeader, Tabs } from "@/components/ui";
import { getGrant, getTrial, isInquiryUnread, listInquiriesForParticipant, listQuestions } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import type { InquiryState } from "@/lib/types";
import { isAnswered } from "@/lib/questions";

export const dynamic = "force-dynamic";

const STATE: Record<InquiryState, { label: string; tone: "peach" | "mint" | "iris" | "neutral"; preview: string }> = {
  draft: { label: "Draft", tone: "neutral", preview: "Not shared yet." },
  shared: { label: "Awaiting review", tone: "neutral", preview: "With the team." },
  acknowledged: { label: "Opened", tone: "iris", preview: "A coordinator has opened this." },
  needs_information: { label: "Needs information", tone: "neutral", preview: "The team asked for something." },
  answered: { label: "Answered", tone: "mint", preview: "You have a reply." },
  approved: { label: "Approved", tone: "mint", preview: "The study team approved this." },
  closed: { label: "Closed", tone: "neutral", preview: "Closed." },
};

function when(iso: string, now: Date) {
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Inbox: messages from research teams.
 *
 * "Unread" means the team changed something since the person last opened the
 * thread. It is tracked separately from the inquiry's own state, so reading a
 * message never alters what the coordinator sees.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "unread" || rawTab === "archived" ? rawTab : "all";
  const participant = await getActiveParticipant();
  const now = new Date();

  const inquiries = listInquiriesForParticipant(participant.id);
  const active = inquiries.filter((inquiry) => inquiry.state !== "closed");
  const unread = active.filter(isInquiryUnread);
  const archived = inquiries.filter((inquiry) => inquiry.state === "closed");
  const shown = tab === "unread" ? unread : tab === "archived" ? archived : active;

  return (
    <div className="space-y-4">
      <ScreenHeader art title="Inbox" />

      <Tabs
        current={tab}
        tabs={[
          { id: "all", label: `All (${active.length})`, href: "/inbox" },
          { id: "unread", label: `Unread (${unread.length})`, href: "/inbox?tab=unread" },
          { id: "archived", label: "Archived", href: "/inbox?tab=archived" },
        ]}
      />

      {shown.length === 0 ? (
        <Empty title={tab === "unread" ? "You are all caught up" : tab === "archived" ? "Nothing archived" : "No messages yet"} />
      ) : (
        <ul>
          {shown.map((inquiry) => {
            const trial = getTrial(inquiry.trialId);
            const grant = inquiry.grantId ? getGrant(inquiry.grantId) : null;
            const sender = (grant?.recipientLabel ?? "Study team").replace(/\s*\(.*\)$/, "");
            const initials = sender.split(/\s+/).map((word) => word[0]).filter((c) => /[A-Z]/.test(c ?? "")).slice(0, 4).join("");
            const state = STATE[inquiry.state];
            const answer = listQuestions({ inquiryId: inquiry.id }).find((q) => isAnswered(q))?.answer;
            const isNew = isInquiryUnread(inquiry);
            return (
              <li key={inquiry.id} className="border-b border-rule last:border-0">
                <Link href={`/inquiry/${inquiry.id}`} className="press flex items-start gap-3 py-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">{initials || "ST"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] font-bold text-ink">
                        {isNew ? <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full bg-iris align-middle" /> : null}
                        {sender}{isNew ? <span className="sr-only"> (new)</span> : null}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-ink-faint">{when(inquiry.updatedAt, now)}</span>
                    </span>
                    <span className="block truncate text-[13px] font-semibold text-ink">Re: {trial?.briefTitle ?? inquiry.trialId}</span>
                    <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
                      {inquiry.state === "needs_information" && inquiry.coordinatorNote ? inquiry.coordinatorNote : answer ?? state.preview}
                    </span>
                    <span className="mt-1.5 block"><Pill tone={state.tone}>{state.label}</Pill></span>
                  </span>
                  <CaretRight size={16} weight="bold" className="mt-4 shrink-0 text-iris" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
