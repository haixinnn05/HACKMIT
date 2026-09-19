"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKey, QrCode, ShareNetwork, X } from "@phosphor-icons/react";
import { PassportMark } from "./Brand";

/**
 * The passport card and the decision to present it.
 *
 * A coordinator meeting someone in clinic needs their information without
 * retyping it. Encoding the profile in the QR would be the wrong way to do it: a
 * code carrying a diagnosis is a health disclosure that anyone within camera
 * range can capture, and it cannot be revoked once scanned.
 *
 * So the code carries only a random, ten-minute, revocable link. The data stays
 * on the server behind a grant scoped here, before the code exists. Until the
 * person chooses what to share, the card shows a placeholder rather than a live
 * code, so opening this screen never discloses anything by itself.
 */

export interface FactOption { key: string; label: string; value: string | null }

export interface PassportSummary {
  displayName: string;
  ageLabel: string | null;
  sexLabel: string | null;
  locationLabel: string | null;
  conditionLabel: string | null;
  facts: FactOption[];
  practicalLabel: string | null;
  openQuestionCount: number;
}

interface Code { dataUrl: string; url: string; expiresAt: string }

export function PassportSurface({ summary }: { summary: PassportSummary }) {
  const router = useRouter();
  const recorded = summary.facts.filter((fact) => fact.value);

  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string[]>(["age", "condition", "facts"]);
  // Unknowns are shareable too. "I don't know my HER2 result" is one of the most
  // useful things a coordinator can learn before a first conversation.
  const [factKeys, setFactKeys] = useState<string[]>(() => summary.facts.map((fact) => fact.key));
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [code, setCode] = useState<Code | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  // Count the code down, then drop it: an expired code should not stay on screen.
  useEffect(() => {
    if (!code) return;
    const tick = () => {
      const seconds = Math.round((new Date(code.expiresAt).getTime() - Date.now()) / 1000);
      if (seconds <= 0) { setCode(null); setRemaining(null); router.refresh(); } else setRemaining(seconds);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code, router]);

  useEffect(() => {
    if (!choosing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setChoosing(false);
      openerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    sheetRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [choosing]);

  const closeSheet = () => { setChoosing(false); openerRef.current?.focus(); };

  const toggle = (field: string) =>
    setSelected((current) => current.includes(field) ? current.filter((f) => f !== field) : [...current, field]);
  const toggleFact = (key: string) =>
    setFactKeys((current) => current.includes(key) ? current.filter((k) => k !== key) : [...current, key]);

  const createCode = async () => {
    setState("loading");
    const fields = [
      ...selected.filter((field) => field !== "facts"),
      ...(selected.includes("facts") ? ["facts", ...factKeys.map((key) => `fact:${key}`)] : []),
    ];
    try {
      const response = await fetch("/api/handoff", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fields }),
      });
      if (!response.ok) throw new Error(await response.text());
      setCode(await response.json());
      setState("idle");
      setChoosing(false);
      router.refresh();
    } catch { setState("error"); }
  };

  const rows = [
    { id: "age", label: "Personal information", sub: [summary.ageLabel, summary.sexLabel, summary.locationLabel].filter(Boolean).join(", ") || "Not recorded" },
    { id: "condition", label: "Condition", sub: summary.conditionLabel ?? "Not recorded" },
    { id: "facts", label: "Clinical facts", sub: `${factKeys.length} of ${summary.facts.length} selected, ${summary.facts.length - recorded.length} marked unknown` },
    { id: "practical", label: "Travel preferences", sub: summary.practicalLabel ?? "Not recorded" },
    { id: "questions", label: "Saved questions", sub: summary.openQuestionCount ? `${summary.openQuestionCount} open` : "None saved" },
    { id: "contact", label: "Contact details", sub: selected.includes("contact") ? "Will be shared" : "Not shared" },
  ];

  const minutes = remaining != null ? Math.floor(remaining / 60) : null;
  const seconds = remaining != null ? String(remaining % 60).padStart(2, "0") : null;

  return (
    <>
      <div className="relative -mt-10 rounded-[24px] border border-rule bg-surface px-5 py-4 shadow-[0_14px_36px_rgba(14,13,99,0.10)]">
        <div className="flex items-center gap-3">
          <PassportMark className="size-9 text-iris" />
          <div>
            <p className="text-[13px] font-extrabold tracking-[0.08em] text-ink">TRIAL PASSPORT</p>
            <p className="text-[12px] text-ink-soft">{code ? "Scan to view my shared profile" : "Private until you share"}</p>
          </div>
        </div>

        <div className="mx-auto mt-3 grid size-44 place-items-center rounded-[18px] border border-rule bg-white">
          {code ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={code.dataUrl} alt="Scannable code linking to the information you chose to share" className="size-40 animate-rise" />
          ) : (
            <div className="px-5 text-center">
              <QrCode size={52} weight="thin" className="mx-auto text-rule-strong" />
              <p className="mt-1 text-[12px] leading-snug text-ink-faint">No code is active. Nothing is being shared.</p>
            </div>
          )}
        </div>

        {code && minutes != null ? (
          <p className="mt-2 text-center text-[12px] font-bold text-iris" aria-live="polite">
            Expires in {minutes}:{seconds}
          </p>
        ) : null}

        <p className="mt-3 text-[1.25rem] font-bold tracking-[-0.02em] text-ink">
          {summary.displayName.replace(/\s*\(synthetic\)$/, "")}
        </p>
        <dl className="mt-1.5 space-y-0.5 text-[13px]">
          {[
            ["Age", summary.ageLabel], ["Sex", summary.sexLabel], ["Location", summary.locationLabel],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-20 shrink-0 text-ink-faint">{label}</dt>
              <dd className={value ? "text-ink" : "italic text-ink-faint"}>{value ?? "Not recorded"}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex items-start gap-3 rounded-[16px] bg-lavender px-3.5 py-2.5">
          <LockKey size={20} weight="fill" className="mt-0.5 shrink-0 text-iris" />
          <div>
            <p className="text-[13px] font-bold text-ink">Securely share</p>
            <p className="text-[12px] leading-relaxed text-ink-soft">
              The code holds no health details, just a ten-minute link. You choose what it opens.
            </p>
          </div>
        </div>

        <button
          ref={openerRef} type="button" onClick={() => { setChoosing(true); setState("idle"); }}
          aria-haspopup="dialog"
          className="press cta mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full py-3 text-[15px] font-bold text-white"
        >
          <ShareNetwork size={18} weight="bold" /> {code ? "Create a new code" : "Share QR Code"}
        </button>
      </div>

      {choosing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40">
          <div
            ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1}
            className="animate-rise max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-[28px] bg-surface p-5 pb-8"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="share-title" className="text-[17px] font-bold text-ink">Choose what to share</h2>
                <p className="text-[12.5px] leading-relaxed text-ink-soft">Only what you tick is visible when the code is scanned.</p>
              </div>
              <button type="button" onClick={closeSheet} className="-mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sunken">
                <X size={18} weight="bold" /><span className="sr-only">Close</span>
              </button>
            </div>

            <ul className="mt-3">
              {rows.map((row) => {
                const on = selected.includes(row.id);
                return (
                  <li key={row.id} className="border-b border-rule last:border-0">
                    <label className="flex min-h-14 cursor-pointer items-center gap-3 py-2">
                      <input type="checkbox" checked={on} onChange={() => toggle(row.id)} className="peer sr-only" />
                      <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-[8px] border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-iris ${on ? "border-iris bg-iris text-white" : "border-rule-strong text-transparent"}`}>
                        <Check size={14} weight="bold" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-ink">{row.label}</span>
                        <span className="block truncate text-[12.5px] text-ink-soft">{row.sub}</span>
                      </span>
                    </label>
                    {row.id === "facts" && on && summary.facts.length ? (
                      <ul className="pb-2 pl-9">
                        {summary.facts.map((fact) => (
                          <li key={fact.key}>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px]">
                              <input type="checkbox" checked={factKeys.includes(fact.key)} onChange={() => toggleFact(fact.key)} className="size-[18px] accent-[#5e44fb]" />
                              <span className="flex-1 text-ink">{fact.label}</span>
                              <span className={`max-w-[45%] truncate text-ink-faint ${fact.value ? "" : "italic"}`}>{fact.value ?? "I don't know"}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              Facts you marked as unknown are shown as unknown. They are never filled in or guessed.
            </p>
            {state === "error" ? (
              <p className="mt-2 text-[13px] font-semibold text-blush">The code could not be created, and nothing was shared. Please try again.</p>
            ) : null}

            <button
              type="button" onClick={createCode} disabled={state === "loading" || selected.length === 0}
              className="press cta mt-4 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold text-white disabled:opacity-50"
            >
              {state === "loading" ? "Creating code" : "Create 10-minute code"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
