import { notFound, redirect } from "next/navigation";
import { LockKey } from "@phosphor-icons/react/dist/ssr";
import { PrintButton } from "@/components/CountedTextarea";
import { Callout, Card, Pill, ScreenHeader, StickyAction } from "@/components/ui";
import { autofill, formFor, type ResolvedField } from "@/lib/application";
import { getFictionalFixture } from "@/lib/db";
import { getOpenInquiryForTrial, getParticipatingEnrollment, getTrial, listEnrollments } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { submitApplicationAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const ORIGIN = {
  passport: { label: "From your passport", tone: "mint" as const },
  marked_unknown: { label: "You marked this unknown", tone: "peach" as const },
  not_in_passport: { label: "Only you can answer", tone: "iris" as const },
};

/**
 * A study's application form, filled from the passport.
 *
 * Autofill saves the retyping, and the person stays the author: every field is
 * visible and editable, each says where its value came from, blanks are not sent,
 * and contact details wait for an explicit tick.
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

  const main = fields.filter((field) => field.section !== "Contact");
  const filled = main.filter((field) => field.origin === "passport").length;
  const unknown = main.filter((field) => field.origin === "marked_unknown").length;
  const sections = [...new Set(main.map((field) => field.section))];
  const input = "mt-1 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint";

  const control = (field: ResolvedField) => {
    const name = `f_${field.id}`;
    if (field.kind === "choice") {
      return (
        <select name={name} defaultValue={field.value} className={`${input} min-h-12`}>
          <option value="">Prefer not to say</option>
          {field.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      );
    }
    if (field.kind === "longtext") return <textarea name={name} rows={2} defaultValue={field.value} className={`${input} py-2.5`} />;
    return (
      <input name={name} type={field.kind === "number" ? "number" : "text"} defaultValue={field.value}
        placeholder={field.origin === "marked_unknown" ? "I don't know" : ""} className={`${input} min-h-12`} />
    );
  };

  return (
    <div className="space-y-4">
      <ScreenHeader back={`/trial/${trial.id}`} title="Application form" sub={trial.briefTitle ?? trial.id} action={<PrintButton />} />

      {form.notice ? <p className="text-[13px] leading-relaxed text-ink-soft">{form.notice}</p> : null}

      <p className="text-[13px] leading-relaxed text-ink-soft">
        {filled} of {main.length} answers filled from your passport.
        {unknown ? ` ${unknown} marked unknown are left blank.` : ""}
      </p>

      <form action={submitApplicationAction} className="space-y-4">
        <input type="hidden" name="trialId" value={trial.id} />

        {sections.map((section) => (
          <Card key={section} className="space-y-3.5 p-4">
            <h2 className="text-[14px] font-bold text-ink">{section}</h2>
            {main.filter((field) => field.section === section).map((field) => (
              <label key={field.id} className="block text-[12.5px] font-semibold text-ink">
                <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  {field.label}
                  <Pill tone={ORIGIN[field.origin].tone}>{ORIGIN[field.origin].label}</Pill>
                </span>
                {control(field)}
                {field.help ? <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">{field.help}</span> : null}
              </label>
            ))}
          </Card>
        ))}

        <Card className="p-4">
          <label className="flex min-h-12 cursor-pointer items-start gap-3">
            <input type="checkbox" name="includeContact" className="peer mt-0.5 size-6 shrink-0 accent-[#5e44fb]" />
            <span>
              <span className="block text-[14px] font-bold text-ink">Include my contact details</span>
              <span className="block text-[12.5px] text-ink-soft">Off unless you choose. Without them, the team replies in your Mozaic inbox.</span>
            </span>
          </label>
          <div className="mt-3 space-y-3">
            {fields.filter((field) => field.section === "Contact").map((field) => (
              <label key={field.id} className="block text-[12.5px] font-semibold text-ink">
                {field.label}
                <input name={`f_${field.id}`} defaultValue={field.value} className={`${input} min-h-12`} />
              </label>
            ))}
          </div>
        </Card>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 px-1">
          <input type="checkbox" name="saveBack" defaultChecked className="mt-0.5 size-6 shrink-0 accent-[#5e44fb]" />
          <span>
            <span className="block text-[14px] font-bold text-ink">Save new answers to my passport</span>
            <span className="block text-[12.5px] text-ink-soft">So the next form starts fuller. Only what you typed yourself.</span>
          </span>
        </label>

        <Callout icon={<LockKey size={20} weight="fill" />}>
          Only what is on this form is shared, and you can take it back from your passport. Sending
          it isn&rsquo;t agreeing to take part, and it isn&rsquo;t a screening decision.
        </Callout>

        <StickyAction>
          <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            Send application
          </button>
        </StickyAction>
      </form>
    </div>
  );
}
