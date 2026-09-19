import Link from "next/link";
import { PassportQr } from "./PassportQr";
import { PersonaSwitcher, type PersonaOption } from "./PersonaSwitcher";

const ITEMS = [
  { href: "/", label: "Today", icon: CalendarIcon },
  { href: "/explore", label: "Explore", icon: SearchIcon },
  { href: "/passport", label: "Passport", icon: BookIcon },
  { href: "/coordinator", label: "Site", icon: InboxIcon },
];

export function TopBar({
  currentId, personas,
}: { currentId: string; personas: PersonaOption[] }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
      {/* The prototype must never be mistaken for a live service. */}
      <p className="bg-amber-soft px-4 py-1.5 text-center text-[11px] font-medium leading-snug text-amber">
        Prototype with synthetic people and public registry records. Not a medical
        device. It cannot decide eligibility or enrol anyone.
      </p>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="flex min-h-11 items-center gap-2 py-1 font-semibold tracking-tight text-ink">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-teal text-sm text-white">TP</span>
          Trial Passport
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
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper-raised/97 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-around px-2 py-1.5">
        {left.map((item) => <NavLink key={item.href} {...item} />)}
        {/* The centre control is the in-person handoff, per the passport concept. */}
        <PassportQr participantName={participantName} />
        {right.map((item) => <NavLink key={item.href} {...item} />)}
      </div>
    </nav>
  );
}

function NavLink({ href, label, icon: Icon }: (typeof ITEMS)[number]) {
  return (
    <Link
      href={href}
      className="flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:bg-paper-sunken hover:text-ink"
    >
      <Icon />
      {label}
    </Link>
  );
}

const iconProps = {
  viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  className: "size-5", "aria-hidden": true,
};

function CalendarIcon() {
  return <svg {...iconProps}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
}
function SearchIcon() {
  return <svg {...iconProps}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}
function BookIcon() {
  return <svg {...iconProps}><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" /><path d="M9 8h6M9 12h6" /></svg>;
}
function InboxIcon() {
  return <svg {...iconProps}><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M4 13 6 5h12l2 8v6H4z" /></svg>;
}
