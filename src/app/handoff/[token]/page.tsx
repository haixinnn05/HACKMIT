import type { ReactNode } from "react";
import {
  CaretRight, ChatCircle, FileText, Heart, LockKey, MapPin, Phone, ShieldCheck, User,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, Callout, Card, DataRow } from "@/components/ui";
import { requestNow } from "@/lib/clock";
import { getGrantByToken, getParticipant, getPersonalNote, listQuestions } from "@/lib/repo";
import { isAnswered } from "@/lib/questions";

export const dynamic = "force-dynamic";

/**
 * What a researcher sees after scanning a passport code.
 *
 * The code carried only a random token. Everything below is read on the server
 * against a grant the participant scoped, so the disclosure can be narrowed,
 * expired and revoked after the fact, which a QR carrying the data never could.
 *
 * Unknown, expired and revoked tokens all render identically. Telling them
 * apart would let someone probe which codes had once been valid.
 */
export default async function HandoffPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const grant = getGrantByToken(token);
  const now = requestNow();

  if (!grant) {
    return (
      <Card className="p-6">
        <h1 className="text-[1.25rem] font-bold text-ink">This code is not active</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
          Sharing codes last ten minutes, and the person who made one can revoke it sooner. Ask
          them to show you a new one.
        </p>
      </Card>
    );
  }

  const participant = getParticipant(grant.participantId);
  if (!participant) return null;

  const allowed = new Set(grant.allowedFields);
  const name = participant.displayName.replace(/\s*\(synthetic\)$/, "");
  const minutesLeft = grant.expiresAt ? Math.max(0, Math.ceil((new Date(grant.expiresAt).getTime() - now) / 60000)) : null;
  const sex = participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null;
  const facts = participant.clinicalFacts.filter((fact) => allowed.has(`fact:${fact.key}`));
  const note = allowed.has("age") ? getPersonalNote(participant.id) : null;
  const questions = allowed.has("questions")
    ? listQuestions({ participantId: participant.id }).filter((q) => !isAnswered(q)) : [];

  const sections: { id: string; icon: ReactNode; title: string; sub: string; body: ReactNode }[] = [];

  if (allowed.has("age")) {
    sections.push({
      id: "personal", icon: <User size={22} />, title: "Personal Information", sub: "Age, location, basic details",
      body: (
        <dl>
          <DataRow label="Age" value={participant.ageYears ?? "Not recorded"} muted={participant.ageYears == null} />
          <DataRow label="Sex" value={sex ?? "Not recorded"} muted={!sex} />
          <DataRow label="Location" value={[participant.city, participant.state].filter(Boolean).join(", ") || "Not recorded"} />
        </dl>
      ),
    });
  }
  if (allowed.has("condition") || allowed.has("facts")) {
    sections.push({
      id: "medical", icon: <FileText size={22} />, title: "Medical History", sub: "Relevant conditions and treatments",
      body: (
        <dl>
          {allowed.has("condition") ? <DataRow label="Condition" value={participant.condition ?? "Not recorded"} /> : null}
          {allowed.has("condition") && participant.conditionDetail ? <DataRow label="Detail" value={participant.conditionDetail} /> : null}
          {allowed.has("facts") ? facts.map((fact) => {
            const unknown = fact.provenance === "unknown" || !fact.value;
            // An unknown is reported in the participant's own words. It is never
            // blank and never rendered as a negative.
            return <DataRow key={fact.key} label={fact.label} value={unknown ? "I don't know" : fact.value} muted={unknown} />;
          }) : null}
        </dl>
      ),
    });
  }
  if (allowed.has("practical")) {
    sections.push({
      id: "preferences", icon: <Heart size={22} />, title: "Preferences", sub: "Travel, scheduling, support",
      body: (
        <dl>
          <DataRow label="Travel each way" value={participant.oneWayTravelMinutes != null ? `About ${participant.oneWayTravelMinutes} min` : "Not recorded"} muted={participant.oneWayTravelMinutes == null} />
          <DataRow label="Needs help with travel" value={participant.needsTravelHelp ? "Yes" : "No"} />
          <DataRow label="Can bring someone" value={participant.caregiverAvailable ? "Yes" : "No"} />
          {participant.workConstraints ? <DataRow label="Work" value={participant.workConstraints} /> : null}
        </dl>
      ),
    });
  }
  if (allowed.has("questions")) {
    sections.push({
      id: "questions", icon: <ChatCircle size={22} />, title: "Saved Questions", sub: `${questions.length} waiting to be asked`,
      body: questions.length ? (
        <ol className="space-y-1.5 py-2">
          {questions.map((question, index) => (
            <li key={question.id} className="text-[13px] leading-relaxed text-ink-soft">{index + 1}. {question.text}</li>
          ))}
        </ol>
      ) : <p className="py-2 text-[13px] text-ink-soft">No open questions.</p>,
    });
  }
  if (allowed.has("contact")) {
    sections.push({
      id: "contact", icon: <Phone size={22} />, title: "Contact Details", sub: "Email and phone",
      body: (
        <dl>
          <DataRow label="Email" value={participant.contact.email ?? "Not recorded"} />
          <DataRow label="Phone" value={participant.contact.phone ?? "Not recorded"} />
        </dl>
      ),
    });
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-ink">Shared Patient Profile</h1>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-iris-soft px-3 py-1 text-[12px] font-bold text-iris-deep">
          <ShieldCheck size={15} weight="fill" /> Patient-authorized view
          {minutesLeft != null ? `, expires in ${minutesLeft} min` : ""}
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          This information has been shared by {name} for research purposes only. This view is read-only.
        </p>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-4">
        <Avatar name={name} size="size-16 text-lg" />
        <div className="min-w-0">
          <p className="text-[1.1rem] font-bold text-ink">{name}</p>
          {allowed.has("age") ? (
            <>
              <p className="text-[13px] text-ink-soft">{[participant.ageYears != null ? `Age ${participant.ageYears}` : null, sex].filter(Boolean).join(", ")}</p>
              <p className="flex items-center gap-1 text-[13px] text-ink-soft"><MapPin size={14} className="text-iris" />{[participant.state, "USA"].filter(Boolean).join(", ")}</p>
            </>
          ) : <p className="text-[13px] italic text-ink-faint">Personal details not shared</p>}
        </div>
        </div>
        {note ? <p className="mt-3 rounded-[14px] bg-lavender px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">&ldquo;{note}&rdquo;</p> : null}
      </Card>

      <div className="space-y-2.5">
        {sections.map((section) => (
          <Card key={section.id}><details className="group">
            <summary className="press flex min-h-16 cursor-pointer list-none items-center gap-3.5 px-4 py-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris">{section.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold text-ink">{section.title}</span>
                <span className="block text-[12.5px] text-ink-soft">{section.sub}</span>
              </span>
              <CaretRight size={16} weight="bold" className="text-ink-faint transition-transform group-open:rotate-90" />
            </summary>
            <div className="px-4 pb-3">{section.body}</div>
          </details></Card>
        ))}
      </div>

      {!allowed.has("contact") ? (
        <Callout tone="blocked" title="Contact details were not shared.">
          The participant has chosen not to share their contact information.
        </Callout>
      ) : null}

      <Callout icon={<LockKey size={20} weight="fill" />} title="Limited, patient-authorized information">
        Only the sections {name.split(" ")[0]} chose to share are visible. Everything here is
        self-reported and not medically verified. It is not a screening decision.
      </Callout>
    </div>
  );
}
