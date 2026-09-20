"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Only what the control renders. Passing whole profiles here would serialize
 *  every persona's contact details into the payload of every page. */
export interface PersonaOption {
  id: string;
  displayName: string;
}

/**
 * Switches between prepared synthetic personas.
 *
 * This is a demo affordance, not an account system, and it is labelled as one.
 * Only the personas seeded from `data/fixtures/personas.json` can be selected —
 * the public demo allows no free-form health history, so there is nothing a
 * visitor can type that would end up stored as someone's medical information.
 */
export function PersonaSwitcher({
  currentId, personas,
}: { currentId: string; personas: PersonaOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentId);

  const change = (id: string) => {
    setValue(id);
    startTransition(async () => {
      await fetch("/api/persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    });
  };

  return (
    <label className="block text-[12px] font-semibold text-ink-soft">
      Viewing as
      <select
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3 text-[14px] font-semibold text-ink"
      >
          {personas.map((persona) => (
            <option key={persona.id} value={persona.id}>
              {persona.displayName.replace(/\s*\(synthetic\)$/, "")}
            </option>
          ))}
      </select>
    </label>
  );
}
