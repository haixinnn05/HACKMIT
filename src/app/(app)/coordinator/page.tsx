import Link from "next/link";
import { Card, Empty, Note } from "@/components/ui";
import { getParticipant, getTrial, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * Coordinator inbox.
 *
 * A simulated site account. It shows only inquiries backed by a currently active
 * sharing grant — revoking a grant removes the item rather than greying a field,
 * because a coordinator should not be looking at data the person has withdrawn.
 */
export default function CoordinatorInbox() {
  const inquiries = listInquiriesForCoordinator();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Site inbox</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Inquiries people have chosen to share with this site, with their evidence and the
          information they are missing.
        </p>
      </div>

      <Note tone="caution">
        Simulated staff account — R. Alvarez, Research Coordinator, Harborview Cancer Center.
        This is a demonstration of the coordinator side of the workflow. No real site, staff
        member or participant is involved, and nothing here leaves this app.
      </Note>

      {inquiries.length === 0 ? (
        <Empty title="Nothing waiting">
          When someone shares an inquiry it appears here. Try preparing one from a study in{" "}
          <Link href="/explore" className="text-teal hover:underline">Explore</Link>.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {inquiries.map((inquiry) => {
            const participant = getParticipant(inquiry.participantId);
            const trial = getTrial(inquiry.trialId);
            const questions = listQuestions({ inquiryId: inquiry.id });
            const open = questions.filter((question) => !question.answer).length;

            return (
              <Card as="li" key={inquiry.id} className="transition-colors hover:border-rule-strong">
                <Link href={`/coordinator/${inquiry.id}`} className="block p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        inquiry.state === "shared"
                          ? "border-teal/30 bg-teal-soft text-teal-deep"
                          : "border-rule-strong bg-paper-sunken text-ink-soft"
                      }`}
                    >
                      {inquiry.state.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-ink-faint">
                      {new Date(inquiry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {participant?.displayName ?? "Participant"}
                  </p>
                  <p className="text-sm text-ink-soft">{trial?.briefTitle ?? inquiry.trialId}</p>
                  <p className="mt-1.5 text-xs text-ink-faint">
                    {open} open question{open === 1 ? "" : "s"} ·{" "}
                    {Object.keys(inquiry.sharedFields).length} field
                    {Object.keys(inquiry.sharedFields).length === 1 ? "" : "s"} shared
                  </p>
                </Link>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
