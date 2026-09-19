"use client";

import { useState } from "react";

/** A textarea with a live character count, announced politely near the limit. */
export function CountedTextarea({
  id, name, defaultValue = "", max = 500, rows = 3,
}: { id: string; name: string; defaultValue?: string; max?: number; rows?: number }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="relative">
      <textarea
        id={id} name={name} rows={rows} maxLength={max} value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-[16px] border border-rule bg-surface px-3.5 pb-7 pt-3 text-[14px] leading-relaxed text-ink"
      />
      <span aria-live={value.length > max - 40 ? "polite" : "off"} className="absolute bottom-3 right-3.5 text-[11.5px] text-ink-faint">
        {value.length}/{max}
      </span>
    </div>
  );
}

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()}
      className="no-print press min-h-11 rounded-full border border-rule-strong bg-surface px-4 text-[13px] font-bold text-ink hover:bg-sunken">
      {label}
    </button>
  );
}
