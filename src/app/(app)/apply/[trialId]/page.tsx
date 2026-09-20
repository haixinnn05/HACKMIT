import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/CountedTextarea";
import { ApplyForm } from "@/components/ApplyForm";
import { ScreenHeader } from "@/components/ui";
import { autofill, formFor } from "@/lib/application";
import { getFictionalFixture } from "@/lib/db";
import { getOpenInquiryForTrial, getParticipatingEnrollment, getTrial, listEnrollments } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A study's application form. The passport sits on the page like a card; nothing
 * is filled until the person taps it.
 */
export default async function ApplyPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const trial = getTrial(decodeURIComponent(trialId));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const tookPart = listEnrollments(participant.id).some((entry) => entry.trialId === trial.id && entry.status === "completed");
  if (tookPart) redirect(`/trial/${trial.id}`);
  const underway = getParticipatingEnrollment(participant.id);
  if (underway && underway.trialId !== trial.id) redirect("/");
  const existing = getOpenInquiryForTrial(participant.id, trial.id);
  if (existing) redirect(`/inquiry/${existing.id}`);
  const form = formFor(trial, getFictionalFixture()?.applicationForm);
  const fields = autofill(participant, form);

  return (
    <div className="space-y-4">
      <ScreenHeader back={`/trial/${trial.id}`} title="Application form" sub={trial.briefTitle ?? trial.id} action={<PrintButton />} />
      <ApplyForm
        trialId={trial.id}
        notice={form.notice}
        fields={fields}
        holder={{
          name: participant.displayName.replace(/\s*\(synthetic\)$/, ""),
          age: participant.ageYears != null ? String(participant.ageYears) : null,
          sex: participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null,
          location: [participant.state, participant.country === "United States" ? "USA" : participant.country].filter(Boolean).join(", ") || null,
        }}
      />
    </div>
  );
}
