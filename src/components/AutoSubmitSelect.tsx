"use client";

import { CaretDown } from "@phosphor-icons/react";

/**
 * A filter chip that applies as soon as it changes. Without JavaScript it is
 * still a plain select inside a form, so the search field's Enter key submits it.
 */
export function AutoSubmitSelect({
  name, label, defaultValue, options,
}: { name: string; label: string; defaultValue: string; options: { value: string; label: string }[] }) {
  const active = defaultValue !== "";
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        name={name} defaultValue={defaultValue}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className={`min-h-10 max-w-[9.5rem] appearance-none truncate rounded-full border py-0 pl-3.5 pr-8 text-[13px] font-semibold ${
          active ? "border-iris bg-iris-soft text-iris-deep" : "border-rule bg-surface text-ink"
        }`}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft" />
    </label>
  );
}
