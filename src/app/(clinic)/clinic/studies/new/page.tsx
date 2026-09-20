import { Megaphone } from "@phosphor-icons/react/dist/ssr";
import { Card, ScreenHeader } from "@/components/ui";
import { postStudyAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Post a study.
 *
 * Short on purpose: a coordinator should be able to do this on a phone between
 * visits. Only the first three fields are required. Everything a participant
 * later sees as "not stated" is something left blank here, which is the honest
 * result, and better than a default nobody confirmed.
 */
export default async function NewStudyPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const input = "mt-1 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint";
  const label = "block text-[12.5px] font-semibold text-ink-soft";
  const legend = "text-[15px] font-bold text-ink";
  const hint = "mt-0.5 text-[12px] leading-relaxed text-ink-faint";

  return (
    <div className="space-y-4">
      <ScreenHeader back="/clinic/studies" title="Post a study" />

      {error ? (
        <p role="alert" className="rounded-[14px] bg-blush-soft px-4 py-3 text-[13px] font-semibold text-blush">
          A title, a summary of at least a sentence, and one condition are needed before this can be posted.
        </p>
      ) : null}

      <form action={postStudyAction} className="space-y-4">
        <Card as="section" className="space-y-3.5 p-4">
          <h2 className={legend}>The study</h2>
          <label className={label}>
            Study title
            <input name="title" required minLength={8} maxLength={160} placeholder="e.g. Walking Program During Chemotherapy for Breast Cancer" className={`${input} min-h-12`} />
          </label>
          <label className={label}>
            What it is, in plain words
            <textarea name="summary" required minLength={20} maxLength={1200} rows={4} placeholder="What you are trying to learn, what taking part involves, and for how long." className={`${input} py-2.5`} />
          </label>
          <label className={label}>
            Condition
            <input name="conditions" required maxLength={200} placeholder="Breast cancer" className={`${input} min-h-12`} />
            <span className={hint}>Separate more than one with commas. This is what people search by.</span>
          </label>
          <label className={label}>
            What is being studied (optional)
            <input name="intervention" maxLength={120} placeholder="e.g. Supervised walking program" className={`${input} min-h-12`} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Type
              <select name="studyType" defaultValue="INTERVENTIONAL" className={`${input} min-h-12`}>
                <option value="INTERVENTIONAL">Interventional</option>
                <option value="OBSERVATIONAL">Observational</option>
              </select>
            </label>
            <label className={label}>
              Phase
              <select name="phase" defaultValue="NA" className={`${input} min-h-12`}>
                <option value="NA">Not applicable</option>
                <option value="PHASE1">Phase 1</option><option value="PHASE2">Phase 2</option>
                <option value="PHASE3">Phase 3</option><option value="PHASE4">Phase 4</option>
              </select>
            </label>
            <label className={label}>
              Status
              <select name="status" defaultValue="RECRUITING" className={`${input} min-h-12`}>
                <option value="RECRUITING">Recruiting now</option>
                <option value="NOT_YET_RECRUITING">Not yet recruiting</option>
              </select>
            </label>
            <label className={label}>
              Planned participants
              <input name="enrollment" type="number" inputMode="numeric" min={1} max={100000} placeholder="60" className={`${input} min-h-12`} />
            </label>
          </div>
        </Card>

        <Card as="section" className="space-y-3.5 p-4">
          <div>
            <h2 className={legend}>Who can take part</h2>
            <p className={hint}>One requirement per line, in the words of your protocol.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className={label}>
              Min age
              <input name="minAge" type="number" inputMode="numeric" min={0} max={120} placeholder="18" className={`${input} min-h-12`} />
            </label>
            <label className={label}>
              Max age
              <input name="maxAge" type="number" inputMode="numeric" min={0} max={120} placeholder="75" className={`${input} min-h-12`} />
            </label>
            <label className={label}>
              Sex
              <select name="sex" defaultValue="ALL" className={`${input} min-h-12`}>
                <option value="ALL">All</option><option value="FEMALE">Female</option><option value="MALE">Male</option>
              </select>
            </label>
          </div>
          <label className={label}>
            Must be true (inclusion)
            <textarea name="inclusion" rows={4} maxLength={2000} placeholder={"Diagnosis of stage I to III breast cancer\nCurrently receiving chemotherapy\nECOG performance status 0 to 2"} className={`${input} py-2.5`} />
          </label>
          <label className={label}>
            Must not be true (exclusion)
            <textarea name="exclusion" rows={3} maxLength={2000} placeholder={"Metastatic (stage IV) disease\nPregnant or breastfeeding"} className={`${input} py-2.5`} />
          </label>
        </Card>

        <Card as="section" className="space-y-3.5 p-4">
          <div>
            <h2 className={legend}>What it asks of people (optional)</h2>
            <p className={hint}>Leave blank if the schedule is not settled.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className={label}>
              Site visits
              <input name="visits" type="number" inputMode="numeric" min={1} max={40} placeholder="4" className={`${input} min-h-12`} />
            </label>
            <label className={label}>
              Hours each
              <input name="visitHours" type="number" inputMode="decimal" step="0.5" min={0.5} max={12} placeholder="2" className={`${input} min-h-12`} />
            </label>
            <label className={label}>
              Weeks apart
              <input name="visitGapWeeks" type="number" inputMode="numeric" min={1} max={52} placeholder="4" className={`${input} min-h-12`} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Phone check-ins
              <input name="remoteCalls" type="number" inputMode="numeric" min={0} max={40} placeholder="0" className={`${input} min-h-12`} />
            </label>
            <label className={label}>
              Minutes each
              <input name="remoteMinutes" type="number" inputMode="numeric" min={5} max={180} placeholder="15" className={`${input} min-h-12`} />
            </label>
          </div>
          <fieldset className="space-y-1">
            <legend className={label}>Tick only what your site has confirmed</legend>
            {[
              ["travelReimbursed", "Travel is reimbursed"],
              ["parkingReimbursed", "Parking is reimbursed"],
              ["caregiverWelcome", "A caregiver can come along"],
              ["remoteOption", "Some visits can be remote"],
            ].map(([name, text]) => (
              <label key={name} className="flex min-h-11 cursor-pointer items-center gap-3 text-[13.5px] text-ink">
                <input type="checkbox" name={name} className="size-5 accent-[var(--color-iris)]" /> {text}
              </label>
            ))}
          </fieldset>
          <label className={label}>
            Compensation, if any
            <input name="compensationText" maxLength={160} placeholder="e.g. $40 gift card per completed visit" className={`${input} min-h-12`} />
          </label>
        </Card>

        <button type="submit" className="cta inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
          <Megaphone size={18} weight="bold" /> Post study
        </button>
      </form>
    </div>
  );
}
