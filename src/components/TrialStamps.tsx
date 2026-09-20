"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";

export type TrialStamp = {
  trialId: string;
  title: string;
  fullTitle: string;
  when: string;
  place: string | null;
  past: boolean;
};

const ART = [
  "/stamps/stamp-stethoscope.png",
  "/stamps/stamp-pills.png",
  "/stamps/stamp-microscope.png",
  "/stamps/stamp-heart.png",
  "/stamps/stamp-dna.png",
  "/stamps/stamp-vials.png",
  "/stamps/stamp-bandage.png",
  "/stamps/stamp-lungs.png",
  "/stamps/stamp-thermometer.png",
  "/stamps/stamp-bag.png",
  "/stamps/stamp-clipboard.png",
  "/stamps/stamp-mortar.png",
];

function artFor(index: number) {
  return ART[index % ART.length];
}

const TILT = [-1.6, 0.7, 1.5];

/**
 * Postage stamps for studies the person has already completed. Three to a row;
 * tapping one opens that study in a popup over the album.
 */
export function TrialStamps({ stamps }: { stamps: TrialStamp[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selected = stamps.find((stamp) => stamp.trialId === open) ?? null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  if (stamps.length === 0) {
    return <p className="text-[12.5px] text-ink-soft">None yet.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-3.5">
        {stamps.map((stamp, index) => (
          <li key={stamp.trialId}>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-label={stamp.fullTitle}
              onClick={() => setOpen(stamp.trialId)}
              className="press w-full text-left"
            >
              <span
                className="block overflow-hidden rounded-[4px] bg-white shadow-[0_3px_0_#d5d7ec,0_8px_16px_rgba(14,13,99,0.08)]"
                style={{ transform: `rotate(${TILT[index % 3]}deg)` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={artFor(index)}
                  alt=""
                  width={384}
                  height={512}
                  className="aspect-[3/4] w-full object-cover"
                />
              </span>
              <span className="mt-1.5 line-clamp-2 block px-0.5 text-[10.5px] font-bold leading-snug text-ink">
                {stamp.title}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5"
          onClick={() => setOpen(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stamp-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="animate-rise w-full max-w-[320px] rounded-[24px] bg-surface p-4 shadow-[0_12px_40px_rgba(14,13,99,0.18)]"
          >
            <div className="flex items-start justify-between gap-2">
              <p id="stamp-title" className="min-w-0 text-[14px] font-bold leading-snug text-ink">{selected.fullTitle}</p>
              <button type="button" onClick={() => setOpen(null)} className="-mr-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sunken">
                <X size={18} weight="bold" /><span className="sr-only">Close</span>
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artFor(stamps.findIndex((stamp) => stamp.trialId === selected.trialId))}
              alt=""
              width={384}
              height={512}
              className="mx-auto mt-1 w-[70%] rounded-[4px] object-cover shadow-[0_3px_0_#d5d7ec]"
            />
            <p className="mt-3 font-mono text-[11.5px] text-ink-faint">{selected.trialId}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-soft">
              {selected.when}{selected.place ? ` · ${selected.place}` : ""}
            </p>
            {selected.past ? (
              <p className="mt-3 text-[12.5px] leading-snug text-ink-soft">You already took part in this study, so it is not open to apply to again.</p>
            ) : null}
            <Link
              href={`/trial/${selected.trialId}`}
              className="cta mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full text-[14px] font-bold text-white"
            >
              Open this study
            </Link>
          </div>
        </div>
      ) : null}
    </>
  );
}
