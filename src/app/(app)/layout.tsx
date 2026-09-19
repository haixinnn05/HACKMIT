import { BottomNav } from "@/components/NavLink";

/**
 * The participant app frame: one phone-width column, centred on larger screens.
 *
 * It lives in a route group rather than the root layout so that the scanned
 * passport view renders without it. A nested layout would compose with the root
 * one rather than replace it, and whoever is holding the participant's phone
 * would inherit their navigation.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      {/* The prototype must never be mistaken for a live service. */}
      <p className="no-print bg-peach-soft px-4 pb-1 pt-[max(0.25rem,env(safe-area-inset-top))] text-center text-[10.5px] font-semibold leading-snug text-peach">
        Prototype. Synthetic people, public registry records. Not a medical device.
      </p>
      <main id="main" className="px-5 pb-32 pt-5">{children}</main>
      <BottomNav />
    </div>
  );
}
