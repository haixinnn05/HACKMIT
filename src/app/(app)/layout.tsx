import { redirect } from "next/navigation";
import { BottomNav } from "@/components/NavLink";
import { getRole } from "@/lib/session";

/**
 * The participant app frame: one phone-width column, centred on larger screens.
 *
 * It lives in a route group rather than the root layout so that the scanned
 * passport view renders without it. A nested layout would compose with the root
 * one rather than replace it, and whoever is holding the participant's phone
 * would inherit their navigation.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (role !== "participant") {
    redirect(role === "clinic" ? "/clinic" : "/login");
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-canvas pt-[env(safe-area-inset-top)] shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <main id="main" className="px-5 pb-32 pt-5">{children}</main>
      <BottomNav />
    </div>
  );
}
