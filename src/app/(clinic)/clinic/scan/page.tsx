import { Camera, Keyboard, QrCode } from "@phosphor-icons/react/dist/ssr";
import { Card, ScreenHeader } from "@/components/ui";
import { PassScanner } from "@/components/PassScanner";
import { openPassAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/** Scan: open the passport a participant is showing you. */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ missed?: string }> }) {
  const { missed } = await searchParams;

  return (
    <div className="space-y-4">
      <ScreenHeader title="Scan" />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lavender text-iris"><Camera size={22} weight="fill" /></span>
          <p className="text-[14px] font-bold text-ink">Scan their ticket</p>
        </div>
        <PassScanner />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-peach-soft text-peach"><Keyboard size={22} weight="fill" /></span>
          <p className="text-[14px] font-bold text-ink">Or type the pass number</p>
        </div>
        <form action={openPassAction} className="mt-3.5 space-y-2.5">
          <label className="block text-[12px] font-semibold text-ink-soft">
            <span className="sr-only">Pass number</span>
            <input
              name="pass" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
              minLength={8} maxLength={9} pattern="[0-9A-Fa-f\s-]{8,9}" placeholder="A2A4ABFD"
              aria-invalid={missed ? true : undefined} aria-describedby={missed ? "pass-error" : undefined}
              className="mt-1 min-h-13 w-full rounded-[16px] border border-rule bg-sunken px-4 py-3 font-mono text-[1.15rem] font-semibold uppercase tracking-[0.2em] text-ink placeholder:text-rule-strong"
            />
          </label>
          {missed ? (
            <p id="pass-error" className="text-[12.5px] font-semibold text-blush">No matching passport.</p>
          ) : null}
          <button type="submit" className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            <QrCode size={18} weight="bold" /> Open passport
          </button>
        </form>
      </Card>
    </div>
  );
}
