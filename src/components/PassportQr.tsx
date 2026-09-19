"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

/**
 * The in-person handoff code.
 *
 * A coordinator meeting someone in clinic needs their information without
 * retyping it. The obvious implementation — encode the profile in the QR — is
 * the wrong one: a code carrying a diagnosis is a health disclosure that anyone
 * within camera range can capture, and it cannot be revoked once scanned.
 *
 * So the code carries only a random, short-lived, revocable link. The data stays
 * on the server behind a sharing grant the person configures before the code is
 * generated, and they can revoke it from the passport at any time. Scanning
 * shows only the fields chosen, and says who it was shared with and when it
 * expires.
 */
export function PassportQr({ participantName }: { participantName: string }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<string[]>(["basics", "condition", "practical"]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [payload, setPayload] = useState<{ dataUrl: string; url: string; expiresAt: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) { openerRef.current?.focus(); return; }
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const generate = async () => {
    setState("loading");
    try {
      const response = await fetch("/api/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!response.ok) throw new Error(await response.text());
      setPayload(await response.json());
      setState("ready");
    } catch {
      setState("error");
    }
  };

  const toggle = (field: string) =>
    setFields((current) =>
      current.includes(field) ? current.filter((f) => f !== field) : [...current, field]
    );

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        onClick={() => { setOpen(true); setState("idle"); setPayload(null); }}
        aria-haspopup="dialog"
        className="relative -mt-6 flex size-14 shrink-0 items-center justify-center rounded-full border-4 border-paper bg-teal text-white shadow-lg transition-transform hover:bg-teal-deep active:scale-95"
      >
        <span className="sr-only">Show my passport code</span>
        <QrGlyph />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-title"
            tabIndex={-1}
            className="animate-rise max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-rule bg-paper-raised p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="qr-title" className="text-lg font-semibold text-ink">My passport code</h2>
                <p className="text-sm text-ink-soft">{participantName}</p>
              </div>
              <Button variant="quiet" onClick={() => setOpen(false)} aria-label="Close">✕</Button>
            </div>

            {state !== "ready" ? (
              <>
                <p className="mb-3 text-sm leading-relaxed text-ink-soft">
                  Choose what a coordinator sees when they scan this. The code itself contains
                  no health information — only a random link that expires in 15 minutes and that
                  you can revoke from your passport.
                </p>
                <fieldset className="mb-4 space-y-2">
                  <legend className="mb-2 text-sm font-medium text-ink">Share</legend>
                  {[
                    { id: "basics", label: "Name, age and general location" },
                    { id: "condition", label: "Condition and what I've recorded about it" },
                    { id: "practical", label: "Travel, work and caregiver situation" },
                    { id: "questions", label: "My open questions" },
                    { id: "contact", label: "Email and phone" },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-rule px-3 py-2 text-sm hover:bg-paper-sunken"
                    >
                      <input
                        type="checkbox"
                        checked={fields.includes(option.id)}
                        onChange={() => toggle(option.id)}
                        className="size-5 accent-teal"
                      />
                      <span className="text-ink">{option.label}</span>
                    </label>
                  ))}
                </fieldset>
                {state === "error" ? (
                  <p className="mb-3 text-sm text-clay">
                    The code could not be created. Nothing was shared. Please try again.
                  </p>
                ) : null}
                <Button onClick={generate} disabled={state === "loading" || fields.length === 0} className="w-full">
                  {state === "loading" ? "Creating code…" : "Create code"}
                </Button>
              </>
            ) : (
              <>
                <div className="mb-3 flex justify-center rounded-xl border border-rule bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={payload!.dataUrl} alt="Scannable code linking to your shared passport summary" className="size-56" />
                </div>
                <p className="mb-1 text-center font-mono text-xs break-all text-ink-faint">{payload!.url}</p>
                <p className="mb-3 text-center text-sm text-ink-soft">
                  Expires {new Date(payload!.expiresAt).toLocaleTimeString()}. Revoke it any time
                  from <strong className="font-medium">Who can see what</strong> in your passport.
                </p>
                <div className="rounded-lg border border-rule bg-paper-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-soft">
                  Scanning this does not enrol you in anything and does not give anyone access to
                  your account. Revoking blocks further access through the app, but it cannot
                  recall anything already read or written down.
                </div>
                <Button variant="secondary" onClick={() => setOpen(false)} className="mt-3 w-full">Done</Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function QrGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <path d="M14 14h3v3h-3zM19.5 14v3M14 19.5h7" strokeLinecap="round" />
    </svg>
  );
}
