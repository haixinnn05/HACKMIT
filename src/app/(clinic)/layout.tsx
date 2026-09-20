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
 * navigation. The header is dark ink where the participant app is lavender.
 */
export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (role !== "clinic") {
    redirect(role === "participant" ? "/" : "/login");
  }

  const needsReview = listInquiriesForCoordinator().filter((inquiry) => ["shared", "acknowledged"].includes(inquiry.state)).length;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <header className="no-print bg-ink px-5 pb-2.5 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <MozaicMark tone="white" className="h-5 w-auto shrink-0" />
            <p className="truncate text-[13px] font-bold leading-tight">{STAFF.name}</p>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12 hover:bg-white/20" aria-label="Log out">
              <SignOut size={16} weight="bold" />
            </button>
          </form>
        </div>
      </header>
      <main id="main" className="px-5 pb-32 pt-5">{children}</main>
      <ClinicNav badge={needsReview} />
    </div>
  );
}
