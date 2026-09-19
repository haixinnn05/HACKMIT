import Link from "next/link";
import type { ReactNode } from "react";
import { STALE_RECORD_MONTHS, monthsSince } from "@/lib/clock";
import type { AssessmentStatus, Provenance } from "@/lib/types";

/* Shared presentational primitives. */

export function Card({
  children, className = "", as: Tag = "div",
}: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return (
    <Tag className={`rounded-2xl border border-rule bg-paper-raised shadow-[0_7px_22px_rgba(23,23,32,0.055)] ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHeading({
  children, hint, id,
}: { children: ReactNode; hint?: ReactNode; id?: string }) {
  return (
    <div className="mb-3.5">
      <h2 id={id} className="text-xl font-semibold tracking-[-0.015em] text-ink">{children}</h2>
      {hint ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/**
 * Status chips. Every one carries a word and a distinct glyph, so the meaning
 * survives greyscale printing and colour-vision differences.
 */
const STATUS_STYLES: Record<AssessmentStatus, { label: string; glyph: string; className: string }> = {
  supported: { label: "Matches what you recorded", glyph: "✓", className: "bg-teal-soft text-teal-deep border-teal/30" },
  conflict: { label: "Possible conflict", glyph: "!", className: "bg-clay-soft text-clay border-clay/30" },
  unknown: { label: "Not enough information", glyph: "?", className: "bg-paper-sunken text-ink-soft border-rule-strong" },
  needs_clinical_review: { label: "Needs staff review", glyph: "◆", className: "bg-slate-soft text-slate border-slate/30" },
};

export function StatusChip({ status, compact = false }: { status: AssessmentStatus; compact?: boolean }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.className}`}
    >
      <span aria-hidden className="font-mono leading-none">{style.glyph}</span>
      {compact ? null : style.label}
    </span>
  );
}

const PROVENANCE_LABEL: Record<Provenance, string> = {
  registry: "From the registry record",
  site_confirmed: "Confirmed by the study site",
  site_confirmed_fictional: "Confirmed by simulated staff (fictional fixture)",
  participant_entered: "You entered this",
  unknown: "Not known",
};

/** Where a fact came from, shown next to the fact rather than in a footnote. */
export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  const isUnknown = provenance === "unknown";
  const isFiction = provenance === "site_confirmed_fictional";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
        isUnknown
          ? "border-rule-strong bg-paper-sunken text-ink-faint"
          : isFiction
            ? "border-amber/40 bg-amber-soft text-amber"
            : "border-rule bg-paper-sunken text-ink-soft"
      }`}
    >
      {PROVENANCE_LABEL[provenance]}
    </span>
  );
}

/** Marks anything invented. Loud on purpose — it must never be mistaken for real. */
export function FictionBanner({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber/40 bg-amber-soft px-3.5 py-2.5 text-sm text-amber">
      <span aria-hidden className="mt-0.5 font-mono font-bold">▲</span>
      <p className="leading-relaxed">
        <strong className="font-semibold">Fictional study.</strong>{" "}
        {children ??
          "This study, its site, its staff and its schedule are invented for this demonstration. It is not a real trial and nobody can enrol in it."}
      </p>
    </div>
  );
}

export function Note({
  children, tone = "neutral",
}: { children: ReactNode; tone?: "neutral" | "caution" }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed ${
        tone === "caution"
          ? "border-amber/30 bg-amber-soft text-amber"
          : "border-blue/15 bg-blue-soft text-slate"
      }`}
    >
      <span aria-hidden className="mt-1 block size-1.5 shrink-0 rounded-full bg-current" />
      <p>{children}</p>
    </div>
  );
}

export function Button({
  children, variant = "primary", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-deep border-teal shadow-[0_6px_16px_rgba(100,55,245,0.2)]",
    secondary: "bg-paper-raised text-ink hover:bg-paper-sunken border-rule-strong shadow-[0_3px_10px_rgba(23,23,32,0.05)]",
    quiet: "bg-transparent text-ink-soft hover:text-ink hover:bg-paper-sunken border-transparent",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children, href, variant = "primary", className = "",
}: { children: ReactNode; href: string; variant?: "primary" | "secondary"; className?: string }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-deep border-teal shadow-[0_6px_16px_rgba(100,55,245,0.2)]",
    secondary: "bg-paper-raised text-ink hover:bg-paper-sunken border-rule-strong shadow-[0_3px_10px_rgba(23,23,32,0.05)]",
  }[variant];
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:translate-y-px ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-7 text-center">
      <span aria-hidden className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-teal-soft text-teal">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 16.5a7.5 7.5 0 0 1 14 0" />
          <path d="M12 5v4M4.5 10.5l2.8 1.6M19.5 10.5l-2.8 1.6M3 19h18" />
        </svg>
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-soft">{children}</div> : null}
    </Card>
  );
}

export function DataAge({
  date, now, label = "Registry record last updated",
}: { date: string | null; now: number; label?: string }) {
  if (!date) {
    return <span className="text-xs text-ink-faint">Record date not stated</span>;
  }
  const stale = monthsSince(date, now) > STALE_RECORD_MONTHS;
  return (
    <span className={`text-xs ${stale ? "font-medium text-amber" : "text-ink-faint"}`}>
      {label} {date}
      {stale ? " — over a year ago, so recruiting status may have changed" : ""}
    </span>
  );
}
