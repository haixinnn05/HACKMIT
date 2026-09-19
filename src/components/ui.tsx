import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft, CaretRight, Info, Prohibit, Warning } from "@phosphor-icons/react/dist/ssr";
import { STALE_RECORD_MONTHS, monthsSince } from "@/lib/clock";
import { Hills } from "./Brand";
import type { AssessmentStatus, Provenance } from "@/lib/types";

/* Shared presentational primitives. Shape rule: cards 20px, controls 14px,
 * chips and primary actions fully round. */

export function Card({
  children, className = "", as: Tag = "div", id,
}: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li"; id?: string }) {
  return (
    <Tag id={id} className={`rounded-[20px] border border-rule bg-surface shadow-[0_2px_10px_rgba(14,13,99,0.04)] ${className}`}>
      {children}
    </Tag>
  );
}

/**
 * The top of every screen: optional back control, title, one-line purpose and
 * an optional trailing action. `art` adds the hills band used on landing-style
 * screens.
 */
export function ScreenHeader({
  title, sub, back, action, art = false, children,
}: {
  title: ReactNode; sub?: ReactNode; back?: string; action?: ReactNode;
  art?: boolean; children?: ReactNode;
}) {
  const heading = <h1 className="text-[1.4rem] font-bold leading-[1.2] tracking-[-0.02em] text-ink">{title}</h1>;
  return (
    <header className={`relative -mx-5 -mt-5 px-5 ${art ? "overflow-hidden bg-lavender pb-14 pt-3" : "pb-1 pt-3"}`}>
      {art ? <Hills /> : null}
      <div className="relative">
        {back ? (
          <div className="-mb-0.5 flex min-h-11 items-center justify-between">
            <Link href={back} className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
              <CaretLeft size={20} weight="bold" />
              <span className="sr-only">Back</span>
            </Link>
            {action}
          </div>
        ) : null}
        {/* Without a back control the action shares the title row, as on the board. */}
        {back ? heading : (
          <div className="flex min-h-11 items-center justify-between gap-3">{heading}{action}</div>
        )}
        {sub ? <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{sub}</p> : null}
        {children}
      </div>
    </header>
  );
}

/**
 * Keeps a screen's one primary action within thumb reach, above the bottom
 * navigation. The spacer stops it covering the end of the content.
 */
export function StickyAction({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-16" />
      <div className="no-print pointer-events-none fixed bottom-[calc(4.4rem+env(safe-area-inset-bottom))] left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-3 pt-6">
        <div className="pointer-events-auto">{children}</div>
      </div>
    </>
  );
}

export function SectionHeading({
  children, hint, id, trailing,
}: { children: ReactNode; hint?: ReactNode; id?: string; trailing?: ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="text-[15px] font-bold tracking-[-0.01em] text-ink">{children}</h2>
        {trailing ? <span className="shrink-0 text-xs text-ink-faint">{trailing}</span> : null}
      </div>
      {hint ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Segmented filter. Plain links, so every tab is a real URL and works without JS. */
export function Tabs({
  tabs, current, variant = "pill",
}: {
  tabs: { id: string; label: string; href: string }[];
  current: string;
  variant?: "pill" | "underline" | "segment";
}) {
  if (variant === "underline") {
    return (
      <nav aria-label="Sections" className="-mx-5 flex gap-5 overflow-x-auto border-b border-rule px-5">
        {tabs.map((tab) => (
          <Link
            key={tab.id} href={tab.href} scroll={false}
            aria-current={tab.id === current ? "page" : undefined}
            className={`-mb-px flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 text-[13px] font-semibold ${
              tab.id === current ? "border-iris text-ink" : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }
  if (variant === "segment") {
    return (
      <nav aria-label="Views" className="grid auto-cols-fr grid-flow-col rounded-[14px] border border-rule bg-surface p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id} href={tab.href} scroll={false}
            aria-current={tab.id === current ? "page" : undefined}
            className={`press flex min-h-10 items-center justify-center rounded-[10px] text-[13px] font-semibold ${
              tab.id === current ? "cta text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Filter" className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.id} href={tab.href} scroll={false}
          aria-current={tab.id === current ? "page" : undefined}
          className={`press inline-flex min-h-10 items-center rounded-full px-4 text-[13px] font-semibold ${
            tab.id === current
              ? "bg-iris text-white"
              : "border border-rule bg-surface text-ink-soft hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** A tappable list row: icon tile, title, supporting line, chevron. */
export function MenuRow({
  href, icon, title, sub, trailing,
}: { href: string; icon: ReactNode; title: ReactNode; sub?: ReactNode; trailing?: ReactNode }) {
  return (
    <Link href={href} className="press flex min-h-16 items-center gap-3.5 px-4 py-3 hover:bg-sunken">
      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold text-ink">{title}</span>
        {sub ? <span className="block text-[12.5px] leading-snug text-ink-soft">{sub}</span> : null}
      </span>
      {trailing}
      <CaretRight size={16} weight="bold" className="shrink-0 text-ink-faint" />
    </Link>
  );
}

type Tone = "iris" | "mint" | "blush" | "peach" | "neutral";
const TONES: Record<Tone, string> = {
  iris: "bg-iris-soft text-iris-deep",
  mint: "bg-mint-soft text-mint",
  blush: "bg-blush-soft text-blush",
  peach: "bg-peach-soft text-peach",
  neutral: "bg-sunken text-ink-soft",
};

export function Pill({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** Status chips. Word plus glyph, so meaning survives without colour. */
const STATUS: Record<AssessmentStatus, { label: string; glyph: string; tone: Tone }> = {
  supported: { label: "Matches what you recorded", glyph: "✓", tone: "mint" },
  conflict: { label: "Possible conflict", glyph: "!", tone: "blush" },
  unknown: { label: "Not enough information", glyph: "?", tone: "iris" },
  needs_clinical_review: { label: "Needs staff review", glyph: "◆", tone: "peach" },
};

export function StatusChip({ status }: { status: AssessmentStatus }) {
  const s = STATUS[status];
  return <Pill tone={s.tone} icon={<span aria-hidden className="font-mono leading-none">{s.glyph}</span>}>{s.label}</Pill>;
}

const PROVENANCE_LABEL: Record<Provenance, string> = {
  registry: "From the registry record",
  site_confirmed: "Confirmed by the study site",
  site_confirmed_fictional: "Confirmed by simulated staff (fictional fixture)",
  participant_entered: "You entered this",
  unknown: "Not known",
};

export function ProvenanceTag({ provenance }: { provenance: Provenance }) {
  const tone: Tone = provenance === "unknown" ? "neutral" : provenance === "site_confirmed_fictional" ? "peach" : "iris";
  return <Pill tone={tone}>{PROVENANCE_LABEL[provenance]}</Pill>;
}

export function Callout({
  children, tone = "info", title, icon,
}: { children: ReactNode; tone?: "info" | "caution" | "blocked" | "neutral"; title?: ReactNode; icon?: ReactNode }) {
  const styles = {
    info: { wrap: "bg-lavender", icon: "text-iris" },
    caution: { wrap: "bg-peach-soft", icon: "text-peach" },
    blocked: { wrap: "bg-sunken", icon: "text-blush" },
    neutral: { wrap: "bg-sunken", icon: "text-ink-faint" },
  }[tone];
  const fallback = tone === "blocked" ? <Prohibit size={20} weight="bold" />
    : tone === "caution" ? <Warning size={20} weight="fill" /> : <Info size={20} weight="fill" />;
  return (
    <div className={`flex items-start gap-3 rounded-[16px] px-4 py-3.5 ${styles.wrap}`}>
      <span className={`mt-0.5 shrink-0 ${styles.icon}`}>{icon ?? fallback}</span>
      <div className="min-w-0 text-[13px] leading-relaxed">
        {title ? <p className="font-bold text-ink">{title}</p> : null}
        <div className={tone === "caution" ? "text-peach" : "text-ink-soft"}>{children}</div>
      </div>
    </div>
  );
}

export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "caution" }) {
  return <Callout tone={tone === "caution" ? "caution" : "neutral"}>{children}</Callout>;
}

/** Marks anything invented. Compact, but on every screen that shows it. */
export function FictionBanner({ children }: { children?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-[14px] bg-peach-soft px-3.5 py-2.5 text-[12px] leading-snug text-peach">
      <Warning size={16} weight="fill" className="mt-px shrink-0" />
      <span>
        <strong className="font-bold">Fictional study.</strong>{" "}
        {children ?? "Invented for this demo, site and staff included. Nobody can enrol in it."}
      </span>
    </p>
  );
}

const BUTTONS = {
  primary: "cta text-white",
  secondary: "border border-rule-strong bg-surface text-ink hover:bg-sunken",
  quiet: "text-ink-soft hover:bg-sunken hover:text-ink",
} as const;
const BUTTON_BASE = "press inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-bold disabled:cursor-not-allowed disabled:opacity-50";

export function Button({
  children, variant = "primary", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTONS }) {
  return <button {...props} className={`${BUTTON_BASE} ${BUTTONS[variant]} ${className}`}>{children}</button>;
}

export function LinkButton({
  children, href, variant = "primary", className = "",
}: { children: ReactNode; href: string; variant?: keyof typeof BUTTONS; className?: string }) {
  return <Link href={href} className={`${BUTTON_BASE} ${BUTTONS[variant]} ${className}`}>{children}</Link>;
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="px-5 py-7 text-center">
      {icon ? <span className="mx-auto mb-2.5 grid size-11 place-items-center rounded-full bg-lavender text-iris">{icon}</span> : null}
      <p className="text-[14px] font-bold text-ink">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-soft">{children}</div> : null}
    </Card>
  );
}

export function Avatar({ name, size = "size-14" }: { name: string; size?: string }) {
  const initials = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("");
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#d9d2fd] to-[#b9aefb] font-bold text-ink ${size}`}>
      {initials}
    </span>
  );
}

export function DataAge({ date, now, label = "Record updated" }: { date: string | null; now: number; label?: string }) {
  if (!date) return <span className="text-xs text-ink-faint">Record date not stated</span>;
  const stale = monthsSince(date, now) > STALE_RECORD_MONTHS;
  return (
    <span className={`text-xs ${stale ? "font-semibold text-peach" : "text-ink-faint"}`}>
      {label} {date}{stale ? ", over a year ago, so recruiting status may have changed" : ""}
    </span>
  );
}

export function DataRow({ label, value, muted = false }: { label: ReactNode; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 border-b border-rule py-3 last:border-0">
      <dt className="text-[13px] text-ink-soft">{label}</dt>
      <dd className={`text-[14px] font-semibold ${muted ? "italic text-ink-faint" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
