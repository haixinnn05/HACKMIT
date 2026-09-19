"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PassportQr } from "./PassportQr";
import { PersonaSwitcher, type PersonaOption } from "./PersonaSwitcher";

const ITEMS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/explore", label: "Explore", icon: SearchIcon },
  { href: "/coordinator", label: "Inbox", icon: InboxIcon },
  { href: "/passport", label: "Profile", icon: ProfileIcon },
];

export function TopBar({
  currentId, personas,
}: { currentId: string; personas: PersonaOption[] }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-white/95 backdrop-blur-xl">
      {/* The prototype must never be mistaken for a live service. */}
      <div className="bg-lemon-soft px-4 py-1.5 text-amber">
        <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-center text-[11px] font-semibold leading-snug">
          <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-amber" />
          Prototype with synthetic people and public registry records. Not a medical
          device. It cannot decide eligibility or enrol anyone.
        </p>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-h-11 items-center gap-2.5 py-1 font-semibold tracking-tight text-ink">
          <BrandMark />
          <span className="whitespace-nowrap font-display text-[1.05rem]">Trial Passport</span>
        </Link>
        <PersonaSwitcher currentId={currentId} personas={personas} />
      </div>
    </header>
  );
}

export function BottomNav({ participantName }: { participantName: string }) {
  const [left, right] = [ITEMS.slice(0, 2), ITEMS.slice(2)];
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(23,23,32,0.08)] backdrop-blur-xl lg:sticky lg:inset-auto lg:order-1 lg:top-28 lg:z-auto lg:mt-8 lg:w-52 lg:shrink-0 lg:self-start lg:rounded-2xl lg:border lg:bg-white lg:p-2 lg:pb-2 lg:shadow-[0_12px_34px_rgba(23,23,32,0.06)]"
    >
      <p className="hidden px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-faint lg:block">
        Navigation
      </p>
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-1.5 lg:flex-col lg:items-stretch lg:justify-start lg:gap-1 lg:px-0 lg:py-0">
        {left.map((item) => <NavLink key={item.href} {...item} />)}
        <div className="lg:order-last lg:mt-2 lg:border-t lg:border-rule lg:px-1 lg:pt-3">
          {/* The centre control is the in-person handoff, per the passport concept. */}
          <PassportQr participantName={participantName} variant="responsive" />
          <p className="mt-2 hidden px-2 text-[11px] leading-relaxed text-ink-faint lg:block">
            Share only what you choose with a short-lived code.
          </p>
        </div>
        {right.map((item) => <NavLink key={item.href} {...item} />)}
      </div>
    </nav>
  );
}

function NavLink({ href, label, icon: Icon }: (typeof ITEMS)[number]) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-2 lg:text-sm ${active ? "bg-teal-soft text-teal-deep" : "text-ink-soft hover:bg-paper-sunken hover:text-ink"}`}
    >
      <span className={active ? "text-teal" : ""}><Icon /></span>
      {label}
    </Link>
  );
}

function BrandMark() {
  return (
    <span aria-hidden className="relative grid size-9 place-items-center rounded-xl bg-teal text-white shadow-[0_5px_14px_rgba(100,55,245,0.22)] transition-transform duration-200 group-hover:-rotate-2">
      <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-coral" />
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4.5h8a2 2 0 0 1 2 2v13H8a2 2 0 0 1-2-2v-12a1 1 0 0 1 1-1Z" />
        <path d="M9.5 9.5h4M11.5 7.5v4M9 15h5" />
      </svg>
    </span>
  );
}

const iconProps = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  className: "size-5", "aria-hidden": true,
};

function HomeIcon() {
  return <svg {...iconProps}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></svg>;
}
function SearchIcon() {
  return <svg {...iconProps}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}
function ProfileIcon() {
  return <svg {...iconProps}><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}
function InboxIcon() {
  return <svg {...iconProps}><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M4 13 6 5h12l2 8v6H4z" /></svg>;
}
