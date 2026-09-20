import { Card, ScreenHeader } from "@/components/ui";
import { backFromMap } from "@/lib/map-return";
import { getPersonalNote } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { updateProfileAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Editing the information itself. Every clinical field can be left blank, and
 * blank is stored as unknown. It is never read as "no", and nothing is filled in
 * from the rest of the answers.
 */
export default async function EditProfilePage({
  searchParams,
}: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const participant = await getActiveParticipant();
  const note = getPersonalNote(participant.id);
  const input = "mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint";
  const label = "block text-[12px] font-semibold text-ink-soft";

  return (
    <div className="space-y-4">
      <ScreenHeader back={backFromMap(from, "/profile")} title="Personal Information" />

      <form action={updateProfileAction} className="space-y-4">
        <Card className="space-y-3 p-4">
          <label className={label}>Condition<input name="condition" defaultValue={participant.condition ?? ""} className={input} /></label>
          <label className={label}>Age<input name="ageYears" type="number" defaultValue={participant.ageYears ?? ""} className={input} /></label>
          <label className={label}>Anything else about your condition<input name="conditionDetail" defaultValue={participant.conditionDetail ?? ""} className={input} /></label>
          <label id="note" className={`${label} scroll-mt-6`}>
            In your own words (optional)
            <input name="personalNote" maxLength={140} defaultValue={note ?? ""} placeholder="What matters most to you about taking part?" className={input} />
          </label>
        </Card>

        <Card id="medical" className="scroll-mt-6 space-y-3 p-4">
          <h2 className="text-[14px] font-bold text-ink">Medical History</h2>
          {participant.clinicalFacts.map((fact) => (
            <label key={fact.key} className={label}>
              {fact.label}
              <input name={`fact_${fact.key}`} defaultValue={fact.value ?? ""} placeholder="I don't know" className={input} />
            </label>
          ))}
        </Card>

        <Card id="preferences" className="scroll-mt-6 space-y-3 p-4">
          <h2 className="text-[14px] font-bold text-ink">Preferences</h2>
          <label className={label}>Travel each way to a site (minutes)<input name="oneWayTravelMinutes" type="number" defaultValue={participant.oneWayTravelMinutes ?? ""} className={input} /></label>
          <label className={label}>Most I can travel (minutes)<input name="maxTravelMinutes" type="number" defaultValue={participant.maxTravelMinutes ?? ""} className={input} /></label>
          <label className={label}>Work or other commitments<input name="workConstraints" defaultValue={participant.workConstraints ?? ""} className={input} /></label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[14px] text-ink">
            <input name="needsTravelHelp" type="checkbox" defaultChecked={participant.needsTravelHelp} className="size-5 accent-[#5e44fb]" />
            I would need help with travel
          </label>
          <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[14px] text-ink">
            <input name="caregiverAvailable" type="checkbox" defaultChecked={participant.caregiverAvailable} className="size-5 accent-[#5e44fb]" />
            Someone can come with me to visits
          </label>
        </Card>

        <button type="submit" className="press cta min-h-13 w-full rounded-full py-3.5 text-[15px] font-bold text-white">Save my information</button>
      </form>
    </div>
  );
}
