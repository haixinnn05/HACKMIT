import { Card, Empty, ScreenHeader } from "@/components/ui";
import { listAudit } from "@/lib/repo";
import { STAFF } from "@/lib/session";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  "grant.created": "A participant shared information", "grant.revoked": "A participant revoked access",
  "inquiry.shared": "An inquiry arrived", "inquiry.acknowledged": "Inquiry acknowledged",
  "inquiry.needs_information": "Information requested from participant",
  "inquiry.approved": "Approved for this study", "inquiry.not_proceeding": "Inquiry closed with a reason",
  "inquiry.reopened": "Inquiry reopened", "pass.scanned": "Passport opened by scanning its code",
  "study.posted": "Study posted", "study.paused": "Recruiting paused", "study.resumed": "Recruiting resumed", "study.removed": "Study removed",
  "question.assigned": "Question assigned", "question.draft_saved": "Draft answer saved",
  "question.answered": "Answer sent", "question.reopened": "Participant reopened a question",
  "question.resolved": "Participant marked a question resolved",
  "pass.opened": "In-person passport opened", "pass.not_found": "Pass number did not match",
  "reply.saved": "Saved reply added", "reply.deleted": "Saved reply deleted", "profile.updated": "A participant updated their profile",
};

/**
 * Activity log. Every disclosure, access and reply leaves a record, so the site
 * can show who saw what and when. It records that something happened and to which
 * record, never the private text itself.
 */
export default function ActivityPage() {
  const events = listAudit(60).filter((event) => !event.action.startsWith("decision."));

  return (
    <div className="space-y-4">
      <ScreenHeader back="/clinic" title="Activity log" />
      {events.length === 0 ? <Empty title="Nothing recorded yet" /> : (
        <Card className="px-4">
          {events.map((event) => (
            <div key={event.id} className="border-b border-rule py-3 last:border-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-bold text-ink">{LABEL[event.action] ?? event.action}</p>
                <p className="shrink-0 text-[11.5px] text-ink-faint">{new Date(event.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
              </div>
              <p className="text-[12px] text-ink-soft">
                {event.actor === STAFF.id ? STAFF.name : "Participant"}{event.detail ? `: ${event.detail}` : ""}
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
