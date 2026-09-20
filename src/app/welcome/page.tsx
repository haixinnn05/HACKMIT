import { ArrowRight, Stethoscope, User } from "@phosphor-icons/react/dist/ssr";
import { Hills, MozaicLockup } from "@/components/Brand";
import { chooseRoleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * The front door: Mozaic has two faces, and this is where you pick one.
 * It is a demo affordance, not a sign-in. Both faces use prepared synthetic
 * accounts, and the research-team face is labelled as simulated throughout.
 */
export default function WelcomePage() {
  const faces = [
    { role: "participant", icon: <User size={26} />, title: "I'm exploring a trial", body: "Understand a study, see what taking part involves, and prepare your questions.", tone: "bg-lavender text-iris" },
    { role: "clinic", icon: <Stethoscope size={26} />, title: "I'm on a research team", body: "Review inquiries people chose to share, answer their questions, and open a passport in clinic.", tone: "bg-ink text-white" },
  ];

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <div className="relative bg-lavender px-6 pb-20 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Hills />
        <div className="relative">
          <MozaicLockup className="h-9 w-auto" />
          <h1 className="mt-6 text-[1.7rem] font-bold leading-[1.15] tracking-[-0.025em] text-ink">Same people.<br />Brighter tomorrows.</h1>
          <p className="mt-2 max-w-[17rem] text-[13.5px] leading-relaxed text-ink-soft">One app, two sides of the same conversation. Choose yours.</p>
        </div>
      </div>

      <main id="main" className="relative z-10 -mt-8 flex-1 space-y-3 px-5 pb-10">
        {faces.map((face) => (
          <form key={face.role} action={chooseRoleAction}>
            <input type="hidden" name="role" value={face.role} />
            <button type="submit" className="flex w-full items-center gap-4 rounded-[22px] border border-rule bg-surface p-4 text-left shadow-[0_6px_20px_rgba(14,13,99,0.07)]">
              <span className={`grid size-14 shrink-0 place-items-center rounded-[16px] ${face.tone}`}>{face.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold text-ink">{face.title}</span>
                <span className="block text-[12.5px] leading-snug text-ink-soft">{face.body}</span>
              </span>
              <ArrowRight size={18} weight="bold" className="shrink-0 text-iris" />
            </button>
          </form>
        ))}
        <p className="px-1 pt-3 text-center text-[11.5px] leading-relaxed text-ink-faint">
          A prototype with synthetic people and public registry records. Both sides use prepared
          demo accounts, and nothing reaches a real research site.
        </p>
      </main>
    </div>
  );
}
