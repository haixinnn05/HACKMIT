import { Camera, Keyboard, QrCode } from "@phosphor-icons/react/dist/ssr";
import { Callout, Card, ScreenHeader } from "@/components/ui";
import { PassScanner } from "@/components/PassScanner";
import { openPassAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Scan: open the passport a participant is showing you.
 *
 * Their ticket carries a QR code and a pass number. Either one opens the same
 * short-lived view of only what they chose to share. A number that is wrong,
 * expired or revoked fails in exactly the same way, so this form cannot be used
 * to find out which codes exist.
 */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ missed?: string }> }) {
  const { missed } = await searchParams;

  return (
    <div className="space-y-4">
      <ScreenHeader title="Open a passport" sub="When a participant shows you their Mozaic ticket, open it one of two ways." />

      <Card className="p-4">
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris"><Camera size={22} /></span>
          <div>
            <p className="text-[14px] font-bold text-ink">Point your camera at the code</p>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">
              Scan the QR on their ticket to open their shared profile. The code holds a link and
              nothing else, and it is read on this phone.
            </p>
          </div>
        </div>
        <PassScanner />
      </Card>

      <Card className="p-4">
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-lavender text-iris"><Keyboard size={22} /></span>
          <div>
            <p className="text-[14px] font-bold text-ink">Or type their pass number</p>
            <p className="text-[12.5px] leading-relaxed text-ink-soft">The eight characters printed on the ticket, under the expiry time.</p>
          </div>
        </div>
        <form action={openPassAction} className="mt-3.5 space-y-2.5">
          <label className="block text-[12px] font-semibold text-ink-soft">
            Pass number
            <input
              name="pass" required autoComplete="off" autoCapitalize="characters" spellCheck={false}
              minLength={8} maxLength={9} pattern="[0-9A-Fa-f\s-]{8,9}" placeholder="A2A4ABFD"
              aria-invalid={missed ? true : undefined} aria-describedby={missed ? "pass-error" : undefined}
              className="mt-1 min-h-13 w-full rounded-[14px] border border-rule bg-surface px-4 py-3 font-mono text-[1.15rem] font-semibold uppercase tracking-[0.2em] text-ink placeholder:text-rule-strong"
            />
          </label>
          {missed ? (
            <p id="pass-error" className="text-[12.5px] font-semibold text-blush">
              No active passport matches that number. Codes last ten minutes, so ask them to create a new one.
            </p>
          ) : null}
          <button type="submit" className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
            <QrCode size={18} weight="bold" /> Open passport
          </button>
        </form>
      </Card>

      <Callout>
        You see only what they ticked, for ten minutes, read-only. It is self-reported and is not a
        screening decision. They can end it sooner from their phone.
      </Callout>
    </div>
  );
}
