import { Card, Note } from "@/components/ui";
import { getGrantByToken, getParticipant, listQuestions } from "@/lib/repo";

export const dynamic = "force-dynamic";

/**
 * What a coordinator sees after scanning a passport code.
 *
 * The code carried only a random token. Everything below is read here, on the
 * server, against a grant the participant configured — so the disclosure can be
 * scoped, expired and revoked after the fact, which a QR carrying the data
 * itself could never be.
 *
 * An unknown, expired or revoked token all render identically. Distinguishing
 * them would let someone probe which codes had once been valid.
 */
export default async function HandoffPage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = getGrantByToken(token);

  if (!grant) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-ink">This code is not active</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            Passport codes expire a few minutes after they are created, and the person who
            created it can revoke it at any time. Ask them to show you a new one.
          </p>
        </Card>
      </div>
    );
  }

  const participant = getParticipant(grant.participantId);
  if (!participant) return null;

  const allowed = new Set(grant.allowedFields);
  const questions = allowed.has("questions")
    ? listQuestions({ participantId: participant.id }).filter((question) => !question.answer)
    : [];

  return (
    <div className="space-y-5">
      <header className="page-intro">
        <p className="text-xs uppercase tracking-wide text-ink-faint">Shared passport</p>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink">
          {allowed.has("basics") ? participant.displayName : "A participant"}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Shared in person. Expires {grant.expiresAt ? new Date(grant.expiresAt).toLocaleTimeString() : "shortly"}.
        </p>
      </header>

      <Note tone="caution">
        Everything below is self-reported and has not been checked against medical records. It
        is not a screening decision and it does not establish eligibility for anything.
      </Note>

      {allowed.has("basics") ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Basics</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Age" value={participant.ageYears != null ? `${participant.ageYears}` : "not shared"} />
            <Row label="Location" value={[participant.city, participant.state].filter(Boolean).join(", ") || "not shared"} />
          </dl>
        </Card>
      ) : null}

      {allowed.has("condition") ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Condition</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Condition" value={participant.condition ?? "not stated"} />
            {participant.conditionDetail ? <Row label="Detail" value={participant.conditionDetail} /> : null}
            {participant.clinicalFacts.map((fact) => (
              <Row
                key={fact.key}
                label={fact.label}
                value={fact.value ?? "the participant does not know"}
                muted={!fact.value}
              />
            ))}
          </dl>
        </Card>
      ) : null}

      {allowed.has("practical") ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Practical situation</h2>
          <dl className="space-y-1.5 text-sm">
            <Row
              label="Travel each way"
              value={participant.oneWayTravelMinutes != null ? `about ${participant.oneWayTravelMinutes} minutes` : "not stated"}
            />
            <Row label="Needs help with travel" value={participant.needsTravelHelp ? "yes" : "no"} />
            <Row label="Someone can attend with them" value={participant.caregiverAvailable ? "yes" : "no"} />
            {participant.workConstraints ? <Row label="Work" value={participant.workConstraints} /> : null}
          </dl>
        </Card>
      ) : null}

      {allowed.has("questions") && questions.length ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Their open questions</h2>
          <ol className="space-y-1.5">
            {questions.map((question, index) => (
              <li key={question.id} className="text-sm leading-relaxed text-ink-soft">
                {index + 1}. {question.text}
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {allowed.has("contact") ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-ink">Contact</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Email" value={participant.contact.email ?? "not shared"} />
            <Row label="Phone" value={participant.contact.phone ?? "not shared"} />
          </dl>
        </Card>
      ) : (
        <Note>
          This person did not share contact details through this code.
        </Note>
      )}
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid gap-0.5 border-b border-rule pb-1.5 last:border-0 last:pb-0 sm:grid-cols-[11rem_1fr]">
      <dt className="text-xs uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={muted ? "text-ink-faint italic" : "text-ink"}>{value}</dd>
    </div>
  );
}
