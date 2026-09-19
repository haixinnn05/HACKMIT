import type { ReactNode } from "react";
import { MozaicLockup } from "@/components/Brand";

/**
 * The scanned passport view, with no participant chrome. Whoever reads this is
 * not the account holder, so there is no navigation to inherit and no other
 * person's name in the payload.
 */
export default function HandoffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <header className="border-b border-rule bg-surface px-5 py-3"><MozaicLockup className="h-6 w-auto" /></header>
      <main id="main" className="px-5 pb-10 pt-5">{children}</main>
    </div>
  );
}
