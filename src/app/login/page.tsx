import { ArrowRight, Stethoscope, User } from "@phosphor-icons/react/dist/ssr";
import { Hills, MozaicLockup } from "@/components/Brand";
import { chooseRoleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Role choice, with no password. The cookie this sets is the demo stand-in
 * for a signed-in patient or clinic account.
 */
export default function LoginPage() {
  const faces = [
    { role: "participant", icon: <User size={26} />, title: "Patient", tone: "bg-lavender text-iris" },
    { role: "clinic", icon: <Stethoscope size={26} />, title: "Clinic / researcher", tone: "bg-ink text-white" },
  ];

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-canvas shadow-[0_0_60px_rgba(14,13,99,0.08)]">
      <div className="relative bg-lavender px-6 pb-20 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <Hills />
        <div className="relative">
          <MozaicLockup className="h-9 w-auto" />
          <h1 className="mt-6 text-[1.7rem] font-bold leading-[1.15] tracking-[-0.025em] text-ink">Log in</h1>
        </div>
      </div>

      <main id="main" className="relative z-10 -mt-8 flex-1 space-y-3 px-5 pb-10">
        {faces.map((face) => (
          <form key={face.role} action={chooseRoleAction}>
            <input type="hidden" name="role" value={face.role} />
            <button type="submit" className="flex w-full items-center gap-4 rounded-[22px] border border-rule bg-surface p-4 text-left shadow-[0_6px_20px_rgba(14,13,99,0.07)]">
              <span className={`grid size-14 shrink-0 place-items-center rounded-[16px] ${face.tone}`}>{face.icon}</span>
              <span className="min-w-0 flex-1 text-[15.5px] font-bold text-ink">{face.title}</span>
              <ArrowRight size={18} weight="bold" className="shrink-0 text-iris" />
            </button>
          </form>
        ))}
      </main>
    </div>
  );
}
