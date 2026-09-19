import Link from "next/link";
import { Card, Empty, Note, SectionHeading } from "@/components/ui";
import {
  getTrial, listGrants, listMilestones, listQuestions, listSavedTrialIds,
} from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { revokeGrantAction, updateProfileAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * My Passport.
 *
 * The reusable half of the product: what you have recorded, what you are still
 * missing, what you saved, and — given equal weight — exactly who can see what,
 * with a way to take it back.
 */
export default async function PassportPage() {
  const participant = await getActiveParticipant();
  const saved = listSavedTrialIds(participant.id).map(getTrial).filter(Boolean);
  const grants = listGrants(participant.id);
  const milestones = listMilestones(participant.id);
  const questions = listQuestions({ participantId: participant.id });
  const unknownFacts = participant.clinicalFacts.filter(
    (fact) => fact.provenance === "unknown" || !fact.value
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My passport</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Everything here stays private until you choose to share it. You can leave anything
          blank — &ldquo;I don&rsquo;t know&rdquo; is a real answer and it is recorded as one.
        </p>
      </header>

      <section aria-labelledby="profile-heading">
        <SectionHeading
          id="profile-heading"
          hint="Used to find relevant studies and to fill in an inquiry. Your contact details are kept separate and are never part of a search."
        >
          About me
        </SectionHeading>

        <Card className="p-4">
          <form action={updateProfileAction} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Condition" name="condition" defaultValue={participant.condition ?? ""} />
              <Field label="Age" name="ageYears" type="number" defaultValue={participant.ageYears ?? ""} />
            </div>
            <Field
              label="Anything else about your condition"
              name="conditionDetail"
              defaultValue={participant.conditionDetail ?? ""}
            />

            <fieldset className="rounded-lg border border-rule p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Clinical facts
              </legend>
              <p className="mb-2.5 text-xs leading-relaxed text-ink-soft">
                Leave a box empty if you do not know. Empty means unknown — it is never read as
                &ldquo;no&rdquo;, and nothing is guessed from the rest of your answers.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {participant.clinicalFacts.map((fact) => (
                  <label key={fact.key} className="block text-xs text-ink-soft">
                    {fact.label}
                    <input
                      name={`fact_${fact.key}`}
                      defaultValue={fact.value ?? ""}
                      placeholder="I don't know"
                      className="mt-1 min-h-11 w-full rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-faint"
                    />
                    {fact.note ? (
                      <span className="mt-0.5 block text-[11px] text-ink-faint">{fact.note}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-lg border border-rule p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Practical situation
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Travel each way to a site (minutes)" name="oneWayTravelMinutes" type="number"
                  defaultValue={participant.oneWayTravelMinutes ?? ""}
                />
                <Field
                  label="Most I can travel (minutes)" name="maxTravelMinutes" type="number"
                  defaultValue={participant.maxTravelMinutes ?? ""}
                />
              </div>
              <div className="mt-3">
                <Field
                  label="Work or other commitments" name="workConstraints"
                  defaultValue={participant.workConstraints ?? ""}
                />
              </div>
              <div className="mt-3 space-y-2">
                <Check label="I would need help with travel" name="needsTravelHelp" defaultChecked={participant.needsTravelHelp} />
                <Check label="Someone can come with me to visits" name="caregiverAvailable" defaultChecked={participant.caregiverAvailable} />
              </div>
            </fieldset>

            <button
              type="submit"
              className="min-h-11 rounded-lg border border-teal bg-teal px-4 text-sm font-medium text-white hover:bg-teal-deep"
            >
              Save my passport
            </button>
          </form>
        </Card>

        {unknownFacts.length ? (
          <Note>
            {unknownFacts.length} thing{unknownFacts.length === 1 ? "" : "s"} you have marked as
            unknown: {unknownFacts.map((fact) => fact.label).join(", ")}. These are not gaps you
            have to fill in alone — a coordinator can usually tell you where to get them.
          </Note>
        ) : null}
      </section>

      {/* -------------------------------------------------- sharing controls */}
      <section aria-labelledby="sharing-heading">
        <SectionHeading
          id="sharing-heading"
          hint="Every disclosure you have made, and what it covered."
        >
          Who can see what
        </SectionHeading>

        {grants.length === 0 ? (
          <Empty title="You have not shared anything">
            Nothing has left your passport.
          </Empty>
        ) : (
          <ul className="space-y-2">
            {grants.map((grant) => {
              const expired = grant.expiresAt ? new Date(grant.expiresAt) < new Date() : false;
              const live = grant.state === "active" && !expired;
              return (
                <Card as="li" key={grant.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{grant.recipientLabel}</p>
                      <p className="text-xs text-ink-soft">{grant.purpose}</p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {grant.allowedFields.join(", ")} · shared{" "}
                        {new Date(grant.createdAt).toLocaleString()}
                        {grant.expiresAt ? ` · expires ${new Date(grant.expiresAt).toLocaleTimeString()}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {live ? (
                        <form action={revokeGrantAction}>
                          <input type="hidden" name="grantId" value={grant.id} />
                          <button
                            type="submit"
                            className="min-h-11 rounded-lg border border-clay/40 bg-clay-soft px-3.5 text-sm font-medium text-clay hover:bg-clay/10"
                          >
                            Revoke
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex min-h-11 items-center rounded-lg border border-rule bg-paper-sunken px-3.5 text-xs text-ink-faint">
                          {grant.state === "revoked" ? "Revoked" : expired ? "Expired" : grant.state}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </ul>
        )}

        <Note tone="caution">
          Revoking stops further access through this app. It cannot recall information someone
          has already read, printed or copied into their own records, and it does not change
          anything held in a study&rsquo;s official research records.
        </Note>
      </section>

      <section aria-labelledby="saved-heading">
        <SectionHeading id="saved-heading">Saved options ({saved.length})</SectionHeading>
        {saved.length === 0 ? (
          <Empty title="Nothing saved yet">
            Studies you save from <Link href="/explore" className="text-teal hover:underline">Explore</Link>{" "}
            appear here.
          </Empty>
        ) : (
          <ul className="space-y-2">
            {saved.map((trial) => (
              <Card as="li" key={trial!.id}>
                <Link href={`/trial/${trial!.id}`} className="flex items-center justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {trial!.briefTitle ?? trial!.id}
                    </span>
                    <span className="block font-mono text-xs text-ink-faint">{trial!.id}</span>
                  </span>
                  <span aria-hidden className="text-teal">→</span>
                </Link>
              </Card>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="questions-heading">
        <SectionHeading id="questions-heading" hint="Your questions stay with you until someone answers them.">
          My questions ({questions.filter((q) => !q.answer).length} open)
        </SectionHeading>
        {questions.length === 0 ? (
          <Empty title="No questions saved" />
        ) : (
          <Card className="p-4">
            <ul className="space-y-2">
              {questions.map((question) => (
                <li key={question.id} className="border-b border-rule pb-2 last:border-0 last:pb-0">
                  <p className="text-sm text-ink">{question.text}</p>
                  <p className="text-xs text-ink-faint">
                    {getTrial(question.trialId)?.briefTitle?.slice(0, 50) ?? question.trialId} ·{" "}
                    {question.state.replace(/_/g, " ")}
                  </p>
                  {question.answer ? (
                    <p className="mt-1 text-sm leading-relaxed text-teal-deep">{question.answer}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section aria-labelledby="milestones-heading">
        <SectionHeading
          id="milestones-heading"
          hint="Private to you. There are no points, no streaks, and nothing here rewards joining or staying in a study."
        >
          Stamps
        </SectionHeading>
        {milestones.length === 0 ? (
          <Empty title="No stamps yet">
            Stamps mark things you did — reading a study overview, preparing questions, getting a
            reply.
          </Empty>
        ) : (
          <Card className="flex flex-wrap gap-2 p-4">
            {milestones.map((milestone) => (
              <span
                key={milestone.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal-soft px-3 py-1.5 text-xs font-medium text-teal-deep"
              >
                <span aria-hidden>◉</span>
                {milestone.label}
              </span>
            ))}
          </Card>
        )}
      </section>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Link
          href="/access-gaps"
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
        >
          What the public data does not say
        </Link>
        <Link
          href="/about"
          className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-rule-strong bg-paper-raised px-4 text-sm font-medium text-ink hover:bg-paper-sunken"
        >
          How this works, and its limits
        </Link>
      </div>
    </div>
  );
}

function Field({
  label, name, defaultValue, type = "text",
}: { label: string; name: string; defaultValue: string | number; type?: string }) {
  return (
    <label className="block text-xs text-ink-soft">
      {label}
      <input
        name={name} type={type} defaultValue={defaultValue}
        className="mt-1 min-h-11 w-full rounded-lg border border-rule bg-paper-raised px-3 text-sm text-ink"
      />
    </label>
  );
}

function Check({
  label, name, defaultChecked,
}: { label: string; name: string; defaultChecked: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="size-5 accent-teal" />
      {label}
    </label>
  );
}
