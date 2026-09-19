import Link from "next/link";
import { CaretRight, ShieldCheck, Tray } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Callout, Card, Empty, Pill, ScreenHeader, Tabs } from "@/components/ui";
import { getParticipant, getTrial, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";

export const dynamic = "force-dynamic";

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
  const replied = inquiries.filter((i) => ["answered", "needs_information", "closed"].includes(i.state));
  const shown = tab === "review" ? needsReview : tab === "replied" ? replied : inquiries;

  return (
    <div className="space-y-4">
      <ScreenHeader back="/inbox" title="Research Team Inbox" sub="Organize patient inquiries and support your study team." />

      <Callout tone="caution" title="Simulated staff account">
        R. Alvarez, Research Coordinator, Harborview Cancer Center. No real site, staff member or
        participant is involved, and nothing here leaves this app.
      </Callout>

      <Tabs
        current={tab}
        tabs={[
          { id: "all", label: `All (${inquiries.length})`, href: "/coordinator" },
          { id: "review", label: `Needs Review (${needsReview.length})`, href: "/coordinator?tab=review" },
          { id: "replied", label: "Replied", href: "/coordinator?tab=replied" },
        ]}
      />

      {shown.length === 0 ? (
        <Empty title="Nothing waiting" icon={<Tray size={22} />}>
          When someone shares an inquiry, it appears here with their evidence and what is missing.
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((inquiry) => {
            const participant = getParticipant(inquiry.participantId);
            const name = (participant?.displayName ?? "Participant").replace(/\s*\(synthetic\)$/, "");
            const open = listQuestions({ inquiryId: inquiry.id }).filter((q) => !q.answer).length;
            return (
              <Card as="li" key={inquiry.id}>
                <Link href={`/coordinator/${inquiry.id}`} className="press flex items-center gap-3 p-4">
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
                      <Pill tone="iris" icon={<ShieldCheck size={12} weight="fill" />}>Patient-authorized</Pill>
                      {open ? <Pill tone="peach">{open} open {open === 1 ? "question" : "questions"}</Pill> : <Pill tone="mint">Replied</Pill>}
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
