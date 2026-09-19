"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flask, House, Scan, Tray, UsersThree } from "@phosphor-icons/react";

const ITEMS = [
  { href: "/clinic", label: "Today", Icon: House, exact: true },
  { href: "/clinic/inbox", label: "Inbox", Icon: Tray },
  { href: "/clinic/scan", label: "Scan", Icon: Scan, centre: true },
  { href: "/clinic/patients", label: "Patients", Icon: UsersThree },
  { href: "/clinic/studies", label: "Studies", Icon: Flask },
];

/**
 * Navigation for the research-team face. The centre control mirrors the
 * participant's: they present a passport, the team scans one.
 */
export function ClinicNav({ badge }: { badge: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Research team"
      className="no-print fixed bottom-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-t border-rule bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="flex items-end justify-around px-2 pb-1.5 pt-1">
        {ITEMS.map(({ href, label, Icon, exact, centre }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          if (centre) {
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined} className="-mt-6 flex flex-col items-center">
                <span className="grid size-[58px] place-items-center rounded-full border-4 border-surface bg-ink text-white shadow-[0_8px_20px_rgba(14,13,99,0.3)]">
                  <Icon size={26} weight="bold" />
                </span>
                <span className="sr-only">{label} a passport</span>
              </Link>
            );
          }
          return (
            <Link
              key={href} href={href} aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 text-[10.5px] font-semibold ${
                active ? "text-ink" : "text-ink-faint hover:text-ink"
              }`}
            >
              <Icon size={22} weight={active ? "fill" : "regular"} />
              {label}
              {label === "Inbox" && badge > 0 ? (
                <span className="absolute right-1.5 top-0.5 grid min-w-[18px] place-items-center rounded-full bg-blush px-1 text-[10px] font-bold leading-[18px] text-white">
                  {badge}<span className="sr-only"> needing review</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
