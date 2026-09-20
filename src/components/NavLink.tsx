"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircle, ClipboardText, House, QrCode, User } from "@phosphor-icons/react";

const ITEMS = [
  { href: "/", label: "Home", Icon: House, match: ["/"] },
  { href: "/explore", label: "Trials", Icon: ClipboardText, match: ["/explore", "/trial"] },
  { href: "/passport", label: "Passport", Icon: QrCode, match: ["/passport"], centre: true },
  { href: "/inbox", label: "Inbox", Icon: ChatCircle, match: ["/inbox", "/inquiry", "/coordinator"] },
  { href: "/profile", label: "Profile", Icon: User, match: ["/profile", "/questions", "/about", "/access-gaps"] },
];

/**
 * Bottom navigation. The centre control is the passport itself, the thing you
 * hand over. The current page is announced with aria-current rather than
 * inferred from colour.
 */
export function BottomNav() {
  const pathname = usePathname();
  const isActive = (match: string[]) =>
    match.some((prefix) => (prefix === "/" ? pathname === "/" : pathname.startsWith(prefix)));

  return (
    <nav
      aria-label="Main"
      suppressHydrationWarning
      className="no-print fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="flex items-end justify-around px-2 pb-1.5 pt-1">
        {ITEMS.map(({ href, label, Icon, match, centre }) => {
          const active = isActive(match);
          if (centre) {
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                suppressHydrationWarning
                className="press -mt-6 flex flex-col items-center"
              >
                <span className="cta grid size-[58px] place-items-center rounded-full border-4 border-surface text-white">
                  <QrCode size={26} weight="bold" />
                </span>
                <span className="sr-only">{label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              suppressHydrationWarning
              className={`press flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 text-[10.5px] font-semibold ${
                active ? "text-iris" : "text-ink-faint hover:text-ink"
              }`}
            >
              <Icon size={22} weight={active ? "fill" : "regular"} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
