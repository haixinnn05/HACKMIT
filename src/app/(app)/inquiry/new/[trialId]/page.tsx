import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, FictionBanner, Note, SectionHeading } from "@/components/ui";
import { getTrial, listQuestions } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { buildDraft, shareInquiryAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Inquiry preview.
 *
 * Nothing leaves the passport until this screen is submitted. The person sees
 * the exact payload — not a description of it — chooses the fields, and edits
 * the message. Autofill reuses what they already confirmed; it never invents a
 * value and never includes a field they did not tick.
 */
export default async function NewInquiryPage({
  params,
}: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const trial = getTrial(decodeURIComponent(trialId));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const draft = await buildDraft(trial.id, participant.id);
  const questions = listQuestions({ participantId: participant.id, trialId: trial.id })
    .filter((question) => question.state === "open");

  const recipient = trial.isFictional
    ? "Harborview Cancer Center, Cambridge — simulated site account"
    : `${trial.leadSponsor ?? "Study team"} (${trial.id})`;

  const groups = [
    {
      id: "basics", label: "Name, age and general location", defaultOn: true,
      preview: [
        participant.displayName,
        participant.ageYears ? `${participant.ageYears} years old` : null,
        [participant.city, participant.state].filter(Boolean).join(", ") || null,
      ].filter(Boolean),
    },
    {
      id: "condition", label: "Condition and what I've recorded about it", defaultOn: true,
      preview: [
        participant.condition,
        participant.conditionDetail,
        ...participant.clinicalFacts.map((fact) =>
          `${fact.label}: ${fact.value ?? "I don't know"}${fact.provenance === "unknown" ? " (marked unknown)" : " (self-reported)"}`
        ),
      ].filter(Boolean) as string[],
    },
    {
      id: "practical", label: "Travel, work and caregiver situation", defaultOn: true,
      preview: [
        participant.oneWayTravelMinutes ? `About ${participant.oneWayTravelMinutes} minutes of travel each way` : null,
        participant.maxTravelMinutes ? `Can travel up to ${participant.maxTravelMinutes} minutes` : null,
        participant.needsTravelHelp ? "Needs help with travel" : null,
        participant.caregiverAvailable ? "Someone can come to visits" : null,
        participant.workConstraints,
      ].filter(Boolean) as string[],
    },
    {
      id: "contact", label: "Email and phone", defaultOn: false,
      preview: [participant.contact.email, participant.contact.phone].filter(Boolean) as string[],
    },
  ];

  return (
    <div className="space-y-5">
      <Link href={`/trial/${trial.id}`} className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">
        ← Back to the study
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Before you share</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          This is exactly what would be sent, and to whom. Nothing has been shared yet.
        </p>
      </div>

      {trial.isFictional ? (
        <FictionBanner>
          This inquiry goes to a simulated site account inside this app. Nothing is sent to
          any real trial site, and no real person receives it.
        </FictionBanner>
      ) : (
        <Note tone="caution">
          In this prototype nothing is sent to a real site. Sharing creates an inquiry inside
          this app so the workflow can be demonstrated end to end.
        </Note>
      )}

      <form action={shareInquiryAction} className="space-y-5">
        <input type="hidden" name="trialId" value={trial.id} />

        <section>
          <SectionHeading hint={`Going to: ${recipient}`}>What you are sharing</SectionHeading>
          <div className="space-y-2.5">
            {groups.map((group) => (
              <Card key={group.id} className="p-3.5">
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                  <input
                    type="checkbox" name="field" value={group.id} defaultChecked={group.defaultOn}
                    className="mt-0.5 size-5 shrink-0 accent-teal"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{group.label}</span>
                    {group.preview.length ? (
                      <ul className="mt-1.5 space-y-0.5">
                        {group.preview.map((line) => (
                          <li key={line} className="font-mono text-xs leading-relaxed text-ink-soft break-words">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="mt-1 block text-xs text-ink-faint">
                        Nothing recorded for this yet.
                      </span>
                    )}
                  </span>
                </label>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            Unticked information is not sent and is not stored with the inquiry. Everything you
            share is marked self-reported, because it has not been checked against medical records.
          </p>
        </section>

        {questions.length ? (
          <section>
            <SectionHeading hint="These go with the inquiry, and the site can answer them one at a time.">
              Questions travelling with this ({questions.length})
            </SectionHeading>
            <Card className="p-3.5">
              <ol className="space-y-1.5">
                {questions.map((question, index) => (
                  <li key={question.id} className="text-sm leading-relaxed text-ink-soft">
                    {index + 1}. {question.text}
                    {question.category === "clinical" ? (
                      <span className="ml-1.5 rounded bg-slate-soft px-1.5 py-0.5 text-[11px] text-slate">
                        for qualified staff
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </Card>
          </section>
        ) : null}

        <section>
          <SectionHeading hint="Written for you from your passport and this study's record. Change anything you like — it is your message.">
            Your message
          </SectionHeading>
          <label className="sr-only" htmlFor="message">Message to the study team</label>
          <textarea
            id="message" name="message" defaultValue={draft} rows={22}
            className="w-full rounded-xl border border-rule bg-paper-raised p-3.5 font-mono text-xs leading-relaxed text-ink"
          />
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            className="min-h-11 flex-1 rounded-lg border border-teal bg-teal px-4 text-sm font-medium text-white hover:bg-teal-deep"
          >
            Share this inquiry
          </button>
          <Link
            href={`/trial/${trial.id}`}
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
          >
            Not yet
          </Link>
        </div>

        <Note>
          Sharing an inquiry is not consent to take part, and it does not enrol you. You can
          revoke a site&rsquo;s access from your passport at any time — though revoking blocks
          future access in the app and cannot recall anything already read.
        </Note>
      </form>
    </div>
  );
}
