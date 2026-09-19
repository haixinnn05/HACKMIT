import Link from "next/link";
import type { ReactNode } from "react";
import { STALE_RECORD_MONTHS, monthsSince } from "@/lib/clock";
import type { AssessmentStatus, Provenance } from "@/lib/types";

/* Shared presentational primitives. */

export function Card({
  children, className = "", as: Tag = "div",
}: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return (
    <Tag className={`rounded-xl border border-rule bg-paper-raised ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionHeading({
  children, hint, id,
}: { children: ReactNode; hint?: ReactNode; id?: string }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">{children}</h2>
      {hint ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{hint}</p> : null}
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
    <p
      className={`rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed ${
        tone === "caution"
          ? "border-amber/30 bg-amber-soft text-amber"
          : "border-rule bg-paper-sunken text-ink-soft"
      }`}
    >
      {children}
    </p>
  );
}

export function Button({
  children, variant = "primary", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-deep border-teal",
    secondary: "bg-paper-raised text-ink hover:bg-paper-sunken border-rule-strong",
    quiet: "bg-transparent text-ink-soft hover:text-ink hover:bg-paper-sunken border-transparent",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children, href, variant = "primary", className = "",
}: { children: ReactNode; href: string; variant?: "primary" | "secondary"; className?: string }) {
  const styles = {
    primary: "bg-teal text-white hover:bg-teal-deep border-teal",
    secondary: "bg-paper-raised text-ink hover:bg-paper-sunken border-rule-strong",
  }[variant];
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card className="p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
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
