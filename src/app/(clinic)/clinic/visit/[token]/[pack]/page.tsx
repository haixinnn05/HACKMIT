import { notFound } from "next/navigation";
import { ScreenHeader } from "@/components/ui";
import { VisitForm } from "@/components/VisitForm";
import { requestNow } from "@/lib/clock";
import { getGrantByToken, getParticipant, getParticipatingEnrollment, listVisitForms } from "@/lib/repo";
import { currentStudyVisit, fillVisitPack, latestVisitAnswers, visitPack } from "@/lib/visit-forms";

export const dynamic = "force-dynamic";

export default async function VisitPackPage({ params }: { params: Promise<{ token: string; pack: string }> }) {
  const { token, pack: packId } = await params;
  const pack = visitPack(packId);
  const grant = getGrantByToken(token);
  if (!pack || !grant) notFound();
  const participant = getParticipant(grant.participantId);
  if (!participant) notFound();

  const enrollment = getParticipatingEnrollment(participant.id);
  const today = new Date(requestNow()).toISOString().slice(0, 10);
  const todaysVisit = currentStudyVisit(enrollment?.visits, today);
  const fields = fillVisitPack(participant, pack, grant.allowedFields);
  const saved = latestVisitAnswers(pack.id, todaysVisit?.name ?? null, listVisitForms(participant.id));

  return (
    <div className="space-y-4">
      <ScreenHeader back={`/clinic/visit/${token}`} title={pack.title} sub={todaysVisit?.name ?? pack.sub} />
      <VisitForm
        token={token}
        packId={pack.id}
        visitName={todaysVisit?.name ?? null}
        fields={fields}
        saved={saved}
        holder={{
          name: participant.displayName.replace(/\s*\(synthetic\)$/, ""),
          age: grant.allowedFields.includes("age") && participant.ageYears != null ? String(participant.ageYears) : null,
          sex: grant.allowedFields.includes("age") && participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null,
          location: grant.allowedFields.includes("age")
            ? [participant.state, participant.country === "United States" ? "USA" : participant.country].filter(Boolean).join(", ") || null
            : null,
        }}
      />
    </div>
  );
}
