import { BottomNav, TopBar } from "@/components/Nav";
import { listParticipants } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";

/**
 * Chrome for the participant-facing app.
 *
 * This lives in a route group rather than in the root layout so that routes
 * outside the group — the scanned handoff view in particular — render without
 * it. A nested layout would compose with the root one, not replace it, and a
 * coordinator holding someone else's phone would still see a persona switcher
 * naming every other person in the system.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const participant = await getActiveParticipant();
  const personas = listParticipants();

  return (
    <>
      <TopBar
        currentId={participant.id}
        personas={personas.map((persona) => ({
          id: persona.id,
          displayName: persona.displayName,
        }))}
      />
      <main id="main" className="mx-auto max-w-3xl px-4 pb-28 pt-5">
        {children}
      </main>
      <BottomNav participantName={participant.displayName} />
    </>
  );
}
