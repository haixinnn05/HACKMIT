import {
  CalendarCheck, ChartBar, ChatCircle, ClockCounterClockwise, FileText, GearSix, Heart, Info,
  LockKey, MapPin, PencilSimple, QrCode, User,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PersonaSwitcher } from "@/components/PersonaSwitcher";
import { Avatar, Card, MenuRow, ScreenHeader, SectionHeading } from "@/components/ui";
import { getPersonalNote, listParticipants, listQuestions, listSavedTrialIds } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { resetDemoAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const participant = await getActiveParticipant();
  const personas = listParticipants();
  const name = participant.displayName.replace(/\s*\(synthetic\)$/, "");
  const sex = participant.sex ? participant.sex[0] + participant.sex.slice(1).toLowerCase() : null;
  const unknown = participant.clinicalFacts.filter((fact) => fact.provenance === "unknown" || !fact.value).length;
  const open = listQuestions({ participantId: participant.id }).filter((q) => !q.answer).length;
  const saved = listSavedTrialIds(participant.id).length;
  const note = getPersonalNote(participant.id);

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

      <div className="flex items-center gap-3 rounded-[16px] bg-lavender px-4 py-3">
        <p className={`min-w-0 flex-1 text-[13px] leading-relaxed ${note ? "text-ink" : "italic text-ink-soft"}`}>
          {note ? <>&ldquo;{note}&rdquo;</> : "Add a line in your own words. Study teams see it when you share your personal information."}
        </p>
        <Link href="/profile/edit#note" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[12.5px] font-bold text-iris">
          <PencilSimple size={14} weight="bold" /> Edit
        </Link>
      </div>

      <Card className="overflow-hidden [&>a]:border-b [&>a]:border-rule [&>a:last-child]:border-0">
        <MenuRow href="/passport" icon={<QrCode size={22} />} title="My Trial Passport" sub="View and share your QR code" />
        <MenuRow href="/profile/edit" icon={<User size={22} />} title="Personal Information" sub="Age, location, condition" />
        <MenuRow href="/profile/edit#medical" icon={<FileText size={22} />} title="Medical History" sub={unknown ? `Conditions and treatments, ${unknown} marked unknown` : "Conditions, treatments"} />
        <MenuRow href="/profile/edit#preferences" icon={<Heart size={22} />} title="Preferences" sub="Travel, scheduling, support" />
        <MenuRow href="/questions" icon={<ChatCircle size={22} />} title="Saved Questions" sub={open ? `${open} waiting for an answer` : "Questions for study teams"} />
        <MenuRow href="/timeline" icon={<CalendarCheck size={22} />} title="Visits & Timeline" sub="Upcoming visits and to-dos" />
        <MenuRow href="/passport#access" icon={<LockKey size={22} />} title="Privacy & Security" sub="Control your data and sharing" />
        <MenuRow href="/profile/saved" icon={<ClockCounterClockwise size={22} />} title="Past / Saved Trials" sub={`${saved} saved`} />
      </Card>

      <Card className="overflow-hidden [&>a]:border-b [&>a]:border-rule [&>a:last-child]:border-0">
        <MenuRow href="/access-gaps" icon={<ChartBar size={22} />} title="What the public data does not say" sub="Gaps in registry records, with denominators" />
        <MenuRow href="/about" icon={<Info size={22} />} title="How this works, and its limits" sub="Sources, matching, privacy" />
      </Card>

      <section aria-labelledby="demo-heading">
        <SectionHeading id="demo-heading" hint="This prototype has no accounts. You can only view it as one of the prepared synthetic people.">
          Demonstration controls
        </SectionHeading>
        <Card className="space-y-3 p-4">
          <PersonaSwitcher currentId={participant.id} personas={personas.map((p) => ({ id: p.id, displayName: p.displayName }))} />
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
