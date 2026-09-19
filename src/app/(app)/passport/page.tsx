import Link from "next/link";
import { GearSix } from "@phosphor-icons/react/dist/ssr";
import { PassportSurface, type PassportSummary } from "@/components/PassportSurface";
import { Callout, Card, Pill, ScreenHeader, SectionHeading } from "@/components/ui";
import { listGrants, listMilestones, listQuestions } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { revokeGrantAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * My Trial Passport: what you would hand over, and who already has access.
 * Editing lives in Profile. This screen is only about disclosure, so nobody
 * changes a fact while meaning to change who can see it.
 */
export default async function PassportPage() {
  const participant = await getActiveParticipant();
  const grants = listGrants(participant.id);
  const milestones = listMilestones(participant.id);
  const openQuestions = listQuestions({ participantId: participant.id }).filter((q) => !q.answer).length;

  const practical = [
    participant.oneWayTravelMinutes != null ? `${participant.oneWayTravelMinutes} min each way` : null,
    participant.needsTravelHelp ? "needs travel help" : null,
    participant.caregiverAvailable ? "can bring someone" : null,
  ].filter(Boolean);

  // Only display strings cross to the client. Contact values never do.
  const summary: PassportSummary = {
    displayName: participant.displayName,
    ageLabel: participant.ageYears != null ? `${participant.ageYears}` : null,
    sexLabel: participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null,
    locationLabel: [participant.state, participant.country === "United States" ? "USA" : participant.country].filter(Boolean).join(", ") || null,
    conditionLabel: participant.condition,
    facts: participant.clinicalFacts.map((fact) => ({
      key: fact.key, label: fact.label, value: fact.provenance === "unknown" ? null : fact.value,
    })),
    practicalLabel: practical.length ? practical.join(", ") : null,
    openQuestionCount: openQuestions,
  };

  return (
    <div className="space-y-5">
      <ScreenHeader
        art title="My Trial Passport" sub="Your information. Your control."
        action={
          <Link href="/profile" className="-mr-2 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <GearSix size={22} /><span className="sr-only">Profile and settings</span>
          </Link>
        }
      />

      <PassportSurface summary={summary} />

      <section aria-labelledby="access-heading" id="access" className="scroll-mt-6">
        <SectionHeading id="access-heading" hint="Every disclosure you have made, and what it covered.">Who can see what</SectionHeading>
        {grants.length === 0 ? (
          <Card className="px-4 py-5 text-center">
            <p className="text-[14px] font-bold text-ink">You have not shared anything</p>
            <p className="text-[12.5px] text-ink-soft">Nothing has left your passport.</p>
          </Card>
        ) : (
          <ul className="space-y-2.5">
            {grants.map((grant) => {
              const expired = grant.expiresAt ? new Date(grant.expiresAt) < new Date() : false;
              const active = grant.state === "active" && !expired;
              const groups = grant.allowedFields.filter((field) => !field.startsWith("fact:"));
              const factCount = grant.allowedFields.length - groups.length;
              return (
                <Card as="li" key={grant.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-bold leading-snug text-ink">{grant.recipientLabel}</p>
                      <p className="mt-0.5 text-[12px] text-ink-soft">
                        {groups.join(", ")}{factCount ? ` (${factCount} facts)` : ""}
                      </p>
                      <p className="text-[11.5px] text-ink-faint">
                        Shared {new Date(grant.createdAt).toLocaleString()}
                        {grant.expiresAt ? `, expires ${new Date(grant.expiresAt).toLocaleTimeString()}` : ""}
                      </p>
                    </div>
                    {active ? (
                      <form action={revokeGrantAction}>
                        <input type="hidden" name="grantId" value={grant.id} />
                        <button type="submit" className="press min-h-11 rounded-full bg-blush-soft px-4 text-[13px] font-bold text-blush">Revoke</button>
                      </form>
                    ) : (
                      <Pill>{grant.state === "revoked" ? "Revoked" : "Expired"}</Pill>
                    )}
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
        <div className="mt-3">
          <Callout tone="caution">
            Revoking stops further access through this app. It cannot recall information someone
            has already read or copied, and it does not change a study&rsquo;s official research records.
          </Callout>
        </div>
      </section>

      <section aria-labelledby="stamps-heading">
        <SectionHeading id="stamps-heading" hint="Private to you. No points, no streaks, and nothing here rewards joining or staying in a study.">
          Stamps
        </SectionHeading>
        {milestones.length === 0 ? (
          <p className="text-[12.5px] text-ink-soft">Stamps mark things you did, such as reading a study overview or preparing questions.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {milestones.map((milestone, index) => (
              <span key={milestone.id} style={{ animationDelay: `${index * 55}ms` }}
                className="animate-stamp inline-flex items-center rounded-full bg-iris-soft px-3 py-1.5 text-[12px] font-bold text-iris-deep">
                {milestone.label}
              </span>
            ))}
          </div>
        )}
      </section>

      <p className="text-center text-[12px] text-ink-faint">Real people. More possibilities.</p>
    </div>
  );
}
