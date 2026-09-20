import Link from "next/link";
import { CaretRight, Tray } from "@phosphor-icons/react/dist/ssr";
import type { InquiryState } from "@/lib/types";
import { Avatar, Card, Empty, Pill, ScreenHeader, Tabs } from "@/components/ui";
import { getParticipant, getTrial, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";
import { isAnswered } from "@/lib/questions";

export const dynamic = "force-dynamic";

const STATUS: Record<InquiryState, { label: string; tone: "iris" | "mint" | "peach" | "blush" | "neutral" }> = {
  draft: { label: "Draft", tone: "neutral" },
  shared: { label: "New", tone: "peach" },
  acknowledged: { label: "Received", tone: "iris" },
  needs_information: { label: "Waiting on them", tone: "peach" },
  answered: { label: "In conversation", tone: "iris" },
  approved: { label: "Approved", tone: "mint" },
  closed: { label: "Closed", tone: "neutral" },
};

/**
 * Research Team Inbox, for a simulated site account.
 *
 * Only inquiries backed by a currently active sharing grant appear. Revoking a
 * grant removes the item outright rather than greying a field, because a
 * coordinator should not be looking at data the person has withdrawn.
 */
export default async function CoordinatorInbox({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "review" || rawTab === "replied" ? rawTab : "all";

  const inquiries = listInquiriesForCoordinator();
  const needsReview = inquiries.filter((i) => ["shared", "acknowledged"].includes(i.state));
  const replied = inquiries.filter((i) => ["answered", "needs_information", "approved", "closed"].includes(i.state));
  const shown = tab === "review" ? needsReview : tab === "replied" ? replied : inquiries;

  return (
    <div className="space-y-4">
      <ScreenHeader title="Inbox" />

      <Tabs
        current={tab}
        tabs={[
          { id: "all", label: `All (${inquiries.length})`, href: "/clinic/inbox" },
          { id: "review", label: `Needs Review (${needsReview.length})`, href: "/clinic/inbox?tab=review" },
          { id: "replied", label: "Replied", href: "/clinic/inbox?tab=replied" },
        ]}
      />

      {shown.length === 0 ? (
        <Empty title="Nothing waiting" icon={<Tray size={22} />} />
      ) : (
        <ul className="space-y-2.5">
          {shown.map((inquiry) => {
            const participant = getParticipant(inquiry.participantId);
            const name = (participant?.displayName ?? "Participant").replace(/\s*\(synthetic\)$/, "");
            const open = listQuestions({ inquiryId: inquiry.id }).filter((q) => !isAnswered(q)).length;
            return (
              <Card as="li" key={inquiry.id}>
                <Link href={`/clinic/inbox/${inquiry.id}`} className="press flex items-center gap-3 p-4">
                  <Avatar name={name} size="size-12 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-bold text-ink">{name}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-faint">
                        {new Date(inquiry.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="block truncate text-[12px] text-ink-soft">{getTrial(inquiry.trialId)?.briefTitle ?? inquiry.trialId}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Pill tone={STATUS[inquiry.state].tone}>{STATUS[inquiry.state].label}</Pill>
                      {open ? <Pill tone="peach">{open} open</Pill> : null}
                    </span>
                  </span>
                  <CaretRight size={16} weight="bold" className="shrink-0 text-iris" />
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
