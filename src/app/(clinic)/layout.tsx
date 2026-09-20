import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { MozaicMark } from "@/components/Brand";
import { ClinicNav } from "@/components/ClinicNav";
import { listInquiriesForCoordinator } from "@/lib/repo";
import { getRole, STAFF } from "@/lib/session";
import { signOutAction } from "@/app/actions";
import { redirect } from "next/navigation";

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
export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (role !== "clinic") {
    redirect(role === "participant" ? "/" : "/login");
  }

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
          <form action={signOutAction}>
            <button type="submit" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/12 px-3 text-[11.5px] font-bold hover:bg-white/20">
              <SignOut size={14} weight="bold" /> Log out
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="px-5 pb-32 pt-5">{children}</main>
      <ClinicNav badge={needsReview} />
    </div>
  );
}
