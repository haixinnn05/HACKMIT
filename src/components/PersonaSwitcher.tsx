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
    <label className="flex items-center gap-2 text-xs text-ink-faint">
      <span className="hidden sm:inline">Viewing as</span>
      <select
        value={value}
        disabled={pending}
        onChange={(event) => change(event.target.value)}
        className="min-h-11 max-w-52 truncate rounded-lg border border-rule bg-paper-raised px-2.5 py-1.5 text-xs font-medium text-ink"
      >
        {personas.map((persona) => (
          <option key={persona.id} value={persona.id}>
            {persona.displayName}
          </option>
        ))}
      </select>
    </label>
  );
}
