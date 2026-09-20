import { GearSix, MapPin, PencilSimple } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { Avatar, Card, MenuRow, ScreenHeader } from "@/components/ui";
import { getPersonalNote, listParticipants, listQuestions, listSavedTrialIds } from "@/lib/repo";
import { getPeerOptIn } from "@/lib/peer-repo";
import { getActiveParticipant } from "@/lib/session";
import { resetDemoAction, signOutAction } from "@/app/actions";
import { isAnswered } from "@/lib/questions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const participant = await getActiveParticipant();
  const personas = listParticipants();
  const name = participant.displayName.replace(/\s*\(synthetic\)$/, "");
  const sex = participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null;
  const open = listQuestions({ participantId: participant.id }).filter((q) => !isAnswered(q)).length;
  const saved = listSavedTrialIds(participant.id).length;
  const note = getPersonalNote(participant.id);
  const peerOn = Boolean(getPeerOptIn(participant.id));

  return (
    <div className="space-y-5">
      <ScreenHeader
        title="My Profile"
        action={
          <Link href="/profile/edit" className="-mr-2 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
            <GearSix size={22} /><span className="sr-only">Edit my information</span>
          </Link>
        }
      />

      <div className="flex items-center gap-4">
        <Avatar name={name} size="size-20 text-xl" />
        <div className="min-w-0">
          <p className="text-[1.25rem] font-bold tracking-[-0.02em] text-ink">{name}</p>
          <p className="text-[13px] text-ink-soft">{[participant.ageYears != null ? `Age ${participant.ageYears}` : null, sex].filter(Boolean).join(", ")}</p>
          <p className="flex items-center gap-1 text-[13px] text-ink-soft">
            <MapPin size={14} className="text-iris" />{[participant.state, "USA"].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      {note ? (
        <div className="flex items-start gap-3 px-1">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">&ldquo;{note}&rdquo;</p>
          <Link href="/profile/edit#note" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[12.5px] font-bold text-iris">
            <PencilSimple size={14} weight="bold" /> Edit
          </Link>
        </div>
      ) : (
        <Link href="/profile/edit#note" className="inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-iris">
          <PencilSimple size={14} weight="bold" /> Edit
        </Link>
      )}

      <Card className="overflow-hidden [&>a]:border-b [&>a]:border-rule [&>a:last-child]:border-0">
        <MenuRow href="/passport" title="My Trial Passport" />
        <MenuRow href="/profile/edit" title="Personal Information" />
        <MenuRow href="/questions" title="Saved Questions" sub={open ? `${open} waiting` : undefined} />
        <MenuRow href="/peers" title="Talk with someone like you" sub={peerOn ? "Matching is on" : undefined} />
        <MenuRow href="/timeline" title="Visits & Timeline" />
        <MenuRow href="/passport#access" title="Privacy & Security" />
        <MenuRow href="/profile/saved" title="Past / Saved Trials" sub={saved ? `${saved} saved` : undefined} />
      </Card>

      <Card className="overflow-hidden [&>a]:border-b [&>a]:border-rule [&>a:last-child]:border-0">
        <MenuRow href="/access-gaps" title="What the public data does not say" />
        <MenuRow href="/about" title="How this works, and its limits" />
      </Card>

      <section>
        <Card className="space-y-3 p-4">
          <PersonaSwitcher currentId={participant.id} personas={personas.map((p) => ({ id: p.id, displayName: p.displayName }))} />
          <form action={signOutAction}>
            <button type="submit" className="press min-h-11 w-full rounded-full bg-ink px-4 text-[13px] font-bold text-white">
              Log out
            </button>
          </form>
          <form action={resetDemoAction}>
            <button type="submit" className="press min-h-11 w-full rounded-full border border-rule-strong bg-surface px-4 text-[13px] font-bold text-ink hover:bg-sunken">
              Reset all demo data
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
