import { notFound, redirect } from "next/navigation";
import { CountedTextarea, PrintButton } from "@/components/CountedTextarea";
import { Card, ScreenHeader, StickyAction } from "@/components/ui";
import { getInquiryForTrial, getTrial, listQuestions } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { buildDraft, shareInquiryAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Review Your Inquiry.
 *
 * Nothing leaves the passport until this screen is submitted. The person sees
 * what each tick covers, contact details start unticked, and the packet that
 * accompanies their note is shown in full and can be edited or printed.
 */
export default async function NewInquiryPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const trial = getTrial(decodeURIComponent(trialId));
  if (!trial) notFound();

  const participant = await getActiveParticipant();
  const existing = getInquiryForTrial(participant.id, trial.id);
  if (existing) redirect(`/inquiry/${existing.id}`);

  const packet = await buildDraft(trial.id, participant.id);
  const questions = listQuestions({ participantId: participant.id, trialId: trial.id }).filter((q) => q.state === "open");

  const groups = [
    { id: "basics", on: true, label: "Personal information", sub: [participant.state, "USA"].filter(Boolean).join(", ") },
    { id: "condition", on: true, label: "Medical history", sub: participant.condition ?? "" },
    { id: "practical", on: true, label: "Travel preferences" },
    { id: "questions", on: true, label: "Saved questions", sub: questions.length ? `${questions.length}` : "" },
    { id: "contact", on: false, label: "Contact details" },
  ];

  const recipient = trial.isFictional
    ? "Harborview Cancer Center, Cambridge"
    : trial.leadSponsor ?? "the study team";

  return (
    <div className="space-y-4">
      <ScreenHeader
        back={`/trial/${trial.id}`}
        title="Review Your Inquiry"
      />

      <form action={shareInquiryAction} className="space-y-4">
        <input type="hidden" name="trialId" value={trial.id} />
        <Card className="px-4 py-1.5">
        <p className="border-b border-rule py-2.5 text-[12px] text-ink-soft">To <strong className="font-bold text-ink">{recipient}</strong></p>
        <ul>
          {groups.map((group) => (
            <li key={group.id}>
              <label className="flex min-h-12 cursor-pointer items-start gap-3.5 py-2">
                <input type="checkbox" name="field" value={group.id} defaultChecked={group.on} className="mt-0.5 size-6 shrink-0 rounded-[8px] accent-[#5e44fb]" />
                <span>
                  <span className="block text-[14px] font-bold text-ink">{group.label}</span>
                  {group.sub ? <span className="block text-[12.5px] text-ink-soft">{group.sub}</span> : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        </Card>

        <div>
          <label htmlFor="note" className="mb-1.5 block text-[14px] font-bold text-ink">Optional personal message</label>
          <CountedTextarea id="note" name="note" defaultValue="I'm very interested in this study and would like to learn more about next steps. Thank you for your time." />
        </div>

        <details className="rounded-[16px] border border-rule bg-surface px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-[13px] font-bold text-iris">See and edit the full packet</summary>
          <label className="sr-only" htmlFor="packet">Inquiry packet</label>
          <textarea id="packet" name="packet" defaultValue={packet} rows={18}
            className="mb-3 w-full rounded-[14px] border border-rule bg-sunken p-3 font-mono text-[11.5px] leading-relaxed text-ink" />
          <div className="pb-4"><PrintButton label="Print this packet" /></div>
        </details>

        <StickyAction>
          <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            Share Inquiry
          </button>
        </StickyAction>
      </form>
    </div>
  );
}
