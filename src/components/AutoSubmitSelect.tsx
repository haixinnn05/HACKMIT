"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

/**
 * A filter chip that applies as soon as it changes. Without JavaScript it is
 * still a plain select inside a form, so the search field's Enter key submits it.
 */
export function AutoSubmitSelect({
  name, label, defaultValue, options,
}: { name: string; label: string; defaultValue: string; options: { value: string; label: string }[] }) {
  const active = defaultValue !== "";
  // A native picker swallows the :active state, so the press is tracked here and
  // handed to the same spring transition every other control uses.
  const [pressed, setPressed] = useState(false);
  return (
    <label
      className="relative shrink-0"
      // Pressing snaps; only the release rides the spring, as with :active elsewhere.
      style={pressed ? { transform: "scale(0.955)", transition: "transform 90ms ease-out" } : undefined}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
    >
      <span className="sr-only">{label}</span>
      <select
        name={name} defaultValue={defaultValue}
        onChange={(event) => { setPressed(false); event.currentTarget.form?.requestSubmit(); }}
        onBlur={() => setPressed(false)}
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
