import Link from "next/link";
import { CaretRight, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Card, Empty, Pill, ScreenHeader } from "@/components/ui";
import { isAnswered } from "@/lib/questions";
import { getParticipant, listEnrollments, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Patients: the people who currently share something with this site.
 *
 * Deliberately not a directory. There is no search box and no way to look up
 * someone who has not started the relationship themselves. A browsable patient
 * database is how a recruiting tool becomes a lead list. When a participant
 * revokes access they leave this list at once.
 */
export default function PatientsPage() {
  const inquiries = listInquiriesForCoordinator();
  const ids = [...new Set(inquiries.map((inquiry) => inquiry.participantId))];

  return (
    <div className="space-y-4">
      <ScreenHeader title="Patients" />

      {ids.length === 0 ? (
        <Empty title="Nobody is sharing with your site yet" icon={<UsersThree size={22} />}>
          People appear here when they share an inquiry, and leave when they revoke it.
        </Empty>
      ) : (
        <ul className="space-y-2.5">
          {ids.map((id) => {
            const participant = getParticipant(id);
            if (!participant) return null;
            const theirs = inquiries.filter((inquiry) => inquiry.participantId === id);
            const sharedBasics = theirs.some((inquiry) => "displayName" in inquiry.sharedFields);
            const name = sharedBasics ? participant.displayName.replace(/\s*\(synthetic\)$/, "") : "Name not shared";
            const open = theirs.flatMap((inquiry) => listQuestions({ inquiryId: inquiry.id })).filter((q) => !isAnswered(q)).length;
            const participating = listEnrollments(id).some((entry) => entry.status === "participating");
            return (
              <Card as="li" key={id}>
                <Link href={`/clinic/patients/${id}`} className="flex items-center gap-3 p-4">
                  <Avatar name={sharedBasics ? name : "?"} size="size-12 text-sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold text-ink">{name}</span>
                    <span className="block text-[12px] text-ink-soft">{theirs.length} {theirs.length === 1 ? "inquiry" : "inquiries"}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      {participating ? <Pill tone="mint">Taking part</Pill> : <Pill tone="iris">Exploring</Pill>}
                      {open ? <Pill tone="peach">{open} open {open === 1 ? "question" : "questions"}</Pill> : null}
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
