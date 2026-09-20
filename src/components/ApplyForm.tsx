"use client";

import { useState } from "react";
import { Check, LockKey } from "@phosphor-icons/react";
import { MozaicMark, TicketRange } from "@/components/Brand";
import { Callout, Card, Pill, StickyAction } from "@/components/ui";
import { submitApplicationAction } from "@/app/actions";
import type { Origin, ResolvedField } from "@/lib/application";

const ORIGIN: Record<Origin, { label: string; tone: "mint" | "peach" | "iris" }> = {
  passport: { label: "From your passport", tone: "mint" },
  marked_unknown: { label: "You marked this unknown", tone: "peach" },
  not_in_passport: { label: "Only you can answer", tone: "iris" },
};

type Holder = {
  name: string;
  age: string | null;
  sex: string | null;
  location: string | null;
};

/**
 * Application form with an Apple Pay-style passport: the ticket sits above the
 * blanks like a card in a wallet. Nothing is filled until the person taps it.
 */
export function ApplyForm({
  trialId, notice, fields, holder,
}: { trialId: string; notice: string | null; fields: ResolvedField[]; holder: Holder }) {
  const main = fields.filter((field) => field.section !== "Contact");
  const contact = fields.filter((field) => field.section === "Contact");
  const ready = main.filter((field) => field.origin === "passport");
  const sections = [...new Set(main.map((field) => field.section))];

  const [applied, setApplied] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.id, ""])));

  const usePassport = () => {
    setValues(Object.fromEntries(fields.map((field) => [field.id, field.origin === "passport" ? field.value : ""])));
    setApplied(true);
  };

  const set = (id: string, value: string) => setValues((current) => ({ ...current, [id]: value }));

  const control = (field: ResolvedField, delay = 0) => {
    const name = `f_${field.id}`;
    const value = values[field.id] ?? "";
    const filled = applied && field.origin === "passport";
    const cls = `mt-1 w-full rounded-[14px] border bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint ${
      filled ? "border-mint passport-just-filled" : "border-rule"
    }`;
    const style = filled ? { animationDelay: `${delay}ms` } : undefined;
    if (field.kind === "choice") {
      return (
        <select name={name} value={value} onChange={(event) => set(field.id, event.target.value)} className={`${cls} min-h-12`} style={style}>
          <option value="">Prefer not to say</option>
          {field.options?.map((option) => <option key={option}>{option}</option>)}
        </select>
      );
    }
    if (field.kind === "longtext") {
      return <textarea name={name} rows={2} value={value} onChange={(event) => set(field.id, event.target.value)} className={`${cls} py-2.5`} style={style} />;
    }
    return (
      <input
        name={name} type={field.kind === "number" ? "number" : "text"} value={value}
        onChange={(event) => set(field.id, event.target.value)}
        placeholder={field.origin === "marked_unknown" ? "I don't know" : ""}
        className={`${cls} min-h-12`} style={style}
      />
    );
  };

  return (
    <>
      {notice ? <p className="text-[13px] leading-relaxed text-ink-soft">{notice}</p> : null}

      <button
        type="button"
        onClick={usePassport}
        disabled={applied}
        aria-pressed={applied}
        className="ticket w-full animate-rise text-left disabled:opacity-100"
      >
        <div className="ticket-top ticket-top-fill relative overflow-hidden rounded-t-[26px] px-5 pb-6 pt-4 text-white">
          <TicketRange />
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MozaicMark tone="white" className="h-7 w-auto" />
              <p className="text-[12.5px] font-extrabold tracking-[0.14em]">MOZAIC PASSPORT</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${applied ? "bg-white text-iris-deep" : "bg-white/18 text-white"}`}>
              {applied ? "Applied" : "Ready"}
            </span>
          </div>
          <p className="relative mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-white/70">Passport holder</p>
          <p className="relative text-[1.5rem] font-bold leading-tight tracking-[-0.02em]">{holder.name}</p>
          <dl className="relative mt-3.5 grid grid-cols-[auto_auto_1fr] gap-x-6">
            {([["Age", holder.age], ["Sex", holder.sex], ["From", holder.location]] as const).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">{label}</dt>
                <dd className={`truncate text-[14px] font-bold ${value ? "" : "italic text-white/60"}`}>{value ?? "Not set"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="ticket-stub -mt-px rounded-b-[26px] bg-surface px-5 pb-4 pt-3">
          <div aria-hidden className="mx-2 border-t-2 border-dashed border-rule-strong" />
          <span className={`mt-3 flex min-h-12 items-center justify-center gap-2 rounded-full text-[14px] font-bold ${applied ? "bg-mint text-white" : "bg-iris text-white"}`}>
            {applied ? <><Check size={16} weight="bold" /> Filled {ready.length} answers</> : `Use this passport · ${ready.length} answers`}
          </span>
        </div>
      </button>

      {applied ? (
        <p className="text-[13px] leading-relaxed text-ink-soft" aria-live="polite">
          {ready.length} of {main.length} answers filled from your passport.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-soft">Tap your passport to fill what it already knows.</p>
      )}

      <form action={submitApplicationAction} className="space-y-4">
        <input type="hidden" name="trialId" value={trialId} />

        {sections.map((section) => {
          const rows = main.filter((field) => field.section === section);
          return (
            <Card key={section} className="space-y-3.5 p-4">
              <h2 className="text-[14px] font-bold text-ink">{section}</h2>
              {rows.map((field, index) => (
                <label key={field.id} className="block text-[12.5px] font-semibold text-ink">
                  <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    {field.label}
                    {applied ? <Pill tone={ORIGIN[field.origin].tone}>{ORIGIN[field.origin].label}</Pill> : null}
                  </span>
                  {control(field, index * 40)}
                  {field.help ? <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">{field.help}</span> : null}
                </label>
              ))}
            </Card>
          );
        })}

        <Card className="p-4">
          <label className="flex min-h-12 cursor-pointer items-start gap-3">
            <input type="checkbox" name="includeContact" className="peer mt-0.5 size-6 shrink-0 accent-[#5e44fb]" />
            <span>
              <span className="block text-[14px] font-bold text-ink">Include my contact details</span>
              <span className="block text-[12.5px] text-ink-soft">Off unless you choose.</span>
            </span>
          </label>
          <div className="mt-3 space-y-3">
            {contact.map((field, index) => (
              <label key={field.id} className="block text-[12.5px] font-semibold text-ink">
                {field.label}
                {control(field, (main.length + index) * 40)}
              </label>
            ))}
          </div>
        </Card>

        <label className="flex min-h-12 cursor-pointer items-start gap-3 px-1">
          <input type="checkbox" name="saveBack" defaultChecked className="mt-0.5 size-6 shrink-0 accent-[#5e44fb]" />
          <span>
            <span className="block text-[14px] font-bold text-ink">Save new answers to my passport</span>
          </span>
        </label>

        <Callout icon={<LockKey size={20} weight="fill" />}>
          Only what is on this form is shared.
        </Callout>

        <StickyAction>
          <button type="submit" className="press cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            Send application
          </button>
        </StickyAction>
      </form>
    </>
  );
}
