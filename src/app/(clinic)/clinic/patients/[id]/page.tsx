import Link from "next/link";
import { CaretRight, HandHeart, LockKey } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Callout, Card, DataRow, Pill, ScreenHeader, SectionHeading } from "@/components/ui";
import { isAnswered, QUESTION_STATE_LABEL } from "@/lib/questions";
import { getParticipant, getTrial, listEnrollments, listInquiriesForCoordinator, listQuestions } from "@/lib/repo";

export const dynamic = "force-dynamic";

const FIELD_LABEL: Record<string, string> = {
  displayName: "Name", ageYears: "Age", location: "Location", condition: "Condition", conditionDetail: "Detail",
  oneWayTravelMinutes: "Travel each way (min)", maxTravelMinutes: "Most they can travel (min)",
  needsTravelHelp: "Needs help with travel", caregiverAvailable: "Can bring someone", workConstraints: "Work",
};

/**
 * One patient, as this site is allowed to see them.
 *
 * The information shown is the snapshot the person shared with each inquiry, not
 * their live profile. If they later add a fact without sharing it, the site does
 * not see it. Access is decided by the grant: with no active grant this page
 * shows nothing, even to someone who kept the link.
 */
export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inquiries = listInquiriesForCoordinator().filter((inquiry) => inquiry.participantId === id);
  const participant = getParticipant(id);

  if (!participant || inquiries.length === 0) {
    return (
      <div className="space-y-4">
        <ScreenHeader back="/clinic/patients" title="Not available" />
        <Card className="p-5 text-[13.5px] leading-relaxed text-ink-soft">
          They are not sharing with your site.
        </Card>
      </div>
    );
  }

  // Merge what was shared across their active inquiries. Later shares win.
  const shared: Record<string, unknown> = {};
  for (const inquiry of [...inquiries].reverse()) Object.assign(shared, inquiry.sharedFields);
  const facts = Array.isArray(shared.clinicalFacts) ? shared.clinicalFacts as { key: string; label: string; value: string | null }[] : [];
  const contact = shared.contact as { email?: string | null; phone?: string | null } | undefined;
  const name = typeof shared.displayName === "string" ? shared.displayName.replace(/\s*\(synthetic\)$/, "") : "Name not shared";

  const questions = inquiries.flatMap((inquiry) => listQuestions({ inquiryId: inquiry.id }));
  const helpRequests = questions.filter((q) => /^Help with my next visit|help me contact the study team/i.test(q.text) && !isAnswered(q));
  const today = new Date().toISOString().slice(0, 10);
  const visits = listEnrollments(id).filter((e) => e.status === "participating" && inquiries.some((i) => i.trialId === e.trialId))
    .flatMap((e) => e.visits).filter((v) => v.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <ScreenHeader back="/clinic/patients" title={name} />

      <div className="flex items-center gap-4">
        <Avatar name={name === "Name not shared" ? "?" : name} size="size-16 text-lg" />
        <div className="flex flex-wrap gap-1.5">
          {visits.length ? <Pill tone="mint">Taking part</Pill> : <Pill tone="iris">Exploring</Pill>}
        </div>
      </div>

      {helpRequests.length ? (
        <Callout tone="caution" icon={<HandHeart size={20} weight="fill" />} title="Asked for help">
          {helpRequests.map((q) => <p key={q.id}>{q.text}</p>)}
        </Callout>
      ) : null}

      <section>
        <SectionHeading>Shared information</SectionHeading>
        <Card className="px-4">
          <dl>
            {Object.entries(FIELD_LABEL).filter(([key]) => shared[key] != null && shared[key] !== "").map(([key, label]) => (
              <DataRow key={key} label={label} value={typeof shared[key] === "boolean" ? (shared[key] ? "Yes" : "No") : String(shared[key])} />
            ))}
            {facts.map((fact) => (
              <DataRow key={fact.key} label={fact.label} value={fact.value ?? "I don't know"} muted={!fact.value} />
            ))}
            {contact ? <><DataRow label="Email" value={contact.email ?? "Not recorded"} /><DataRow label="Phone" value={contact.phone ?? "Not recorded"} /></> : null}
          </dl>
        </Card>
        {!contact ? (
          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-faint">
            <LockKey size={14} className="mt-0.5 shrink-0" /> Contact details were not shared.
          </p>
        ) : null}
      </section>

      <section>
        <SectionHeading>Inquiries</SectionHeading>
        <ul className="space-y-2.5">
          {inquiries.map((inquiry) => {
            const open = listQuestions({ inquiryId: inquiry.id }).filter((q) => !isAnswered(q)).length;
            return (
              <Card as="li" key={inquiry.id}>
                <Link href={`/clinic/inbox/${inquiry.id}`} className="flex items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[13.5px] font-bold leading-snug text-ink">{getTrial(inquiry.trialId)?.briefTitle ?? inquiry.trialId}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5">
                      <Pill tone={inquiry.state === "answered" || inquiry.state === "approved" ? "mint" : "iris"}>{inquiry.state.replace(/_/g, " ")}</Pill>
                      {open ? <Pill tone="peach">{open} open</Pill> : null}
                    </span>
                  </span>
                  <CaretRight size={16} weight="bold" className="shrink-0 text-iris" />
                </Link>
              </Card>
            );
          })}
        </ul>
      </section>

      {questions.length ? (
        <section>
          <SectionHeading>Their questions</SectionHeading>
          <Card className="px-4">
            {questions.map((question) => (
              <div key={question.id} className="flex items-start justify-between gap-3 border-b border-rule py-3 last:border-0">
                <span className="text-[13px] text-ink">{question.text}</span>
                <Pill tone={isAnswered(question) ? "mint" : "peach"}>{QUESTION_STATE_LABEL[question.state]}</Pill>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {visits.length ? (
        <section>
          <SectionHeading>Upcoming visits</SectionHeading>
          <Card className="px-4">
            {visits.map((visit) => (
              <div key={visit.date + visit.name} className="flex items-center justify-between gap-3 border-b border-rule py-3 last:border-0">
                <span className="text-[13.5px] font-bold text-ink">{visit.name}</span>
                <span className="text-[12.5px] text-ink-soft">{new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
