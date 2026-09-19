import type { ReactNode } from "react";

/**
 * The scanned-code view, with no participant chrome.
 *
 * Whoever reads this page is not the account holder — it is the person the
 * participant just handed their phone to. Rendering the app's navigation would
 * put a persona switcher and account links into someone else's hands, and would
 * ship other people's names into a payload the scanner can read.
 */
export default function HandoffLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-b border-rule bg-paper-raised px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <span aria-hidden className="grid size-7 place-items-center rounded-md bg-teal text-sm text-white">
            TP
          </span>
          <span className="font-semibold tracking-tight text-ink">Trial Passport</span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </>
  );
}
