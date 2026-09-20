import Link from "next/link";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/ssr";
import { MozaicMark } from "@/components/Brand";
import { ClinicNav } from "@/components/ClinicNav";
import { listInquiriesForCoordinator } from "@/lib/repo";
import { STAFF } from "@/lib/session";

/**
 * The research-team face.
 *
 * A separate route group with its own chrome, so the two faces never share
 * navigation. The header is dark ink where the participant app is lavender: the
 * difference has to be obvious at a glance, because confusing the two on a shared
 * demo phone would mean a participant browsing as staff.
 *
 * The signed-in person is a simulated staff account, and the header says so on
 * every screen. Nothing here reaches a real site.
 */
export default function ClinicLayout({ children }: { children: React.ReactNode }) {
  const needsReview = listInquiriesForCoordinator().filter((inquiry) => ["shared", "acknowledged"].includes(inquiry.state)).length;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <header className="no-print bg-ink px-5 pb-3 pt-[max(0.6rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <MozaicMark tone="white" className="h-6 w-auto shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight">{STAFF.name}, {STAFF.title}</p>
              <p className="truncate text-[11px] leading-tight text-white/65">{STAFF.site}</p>
            </div>
          </div>
          <Link href="/welcome" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/12 px-3 text-[11.5px] font-bold hover:bg-white/20">
            <ArrowsLeftRight size={14} weight="bold" /> Switch
          </Link>
        </div>
        <p className="mt-1.5 text-center text-[10.5px] font-semibold leading-snug text-white/70">
          Simulated staff account. No real site or patient. Nothing leaves this app.
        </p>
      </header>
      <main id="main" className="px-5 pb-32 pt-5">{children}</main>
      <ClinicNav badge={needsReview} />
    </div>
  );
}
