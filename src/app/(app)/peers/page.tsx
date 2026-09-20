import { Suspense } from "react";
import Link from "next/link";
import { CaretLeft, CaretRight, GearSix, HandHeart, Sparkle, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Hills } from "@/components/Brand";
import { Avatar, Callout, Card, Empty, LinkButton, Pill, SectionHeading } from "@/components/ui";
import { findPeerMatches, findPeerMatchesSmart, getPeerOptIn, listPeerConnections } from "@/lib/peer-repo";
import { getTrial } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { requestPeerAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const STATE = {
  pending: { label: "Waiting for a reply", tone: "peach" as const }, accepted: { label: "Connected", tone: "mint" as const },
  declined: { label: "Not this time", tone: "neutral" as const }, ended: { label: "Ended", tone: "neutral" as const },
  reported: { label: "Reported and closed", tone: "neutral" as const },
};

/**
 * Talk with someone in a similar situation, about a study you are both weighing.
 * A few suggestions for a purpose, never a list of people to browse.
 */
export default async function PeersPage({ searchParams }: { searchParams: Promise<{ trial?: string; tab?: string; from?: string }> }) {
  const { trial: trialId, tab: rawTab, from } = await searchParams;
  const participant = await getActiveParticipant();
  const trial = trialId ? getTrial(trialId) : null;
  const optIn = getPeerOptIn(participant.id);
  const outcome = findPeerMatches(participant.id, trial?.id ?? null);
  const connections = listPeerConnections(participant.id);
  const tab = rawTab === "eligibility" || rawTab === "expect" || rawTab === "insight" ? rawTab : undefined;
  const fromMap = from === "map";
  const peersQuery = new URLSearchParams({
    ...(trial ? { trial: trial.id } : {}),
    ...(tab ? { tab } : {}),
    ...(fromMap ? { from: "map" } : {}),
  });
  const here = `/peers${peersQuery.toString() ? `?${peersQuery}` : ""}`;
  const trialBack = trial
    ? (() => {
        const query = new URLSearchParams();
        if (tab) query.set("tab", tab);
        if (fromMap) query.set("from", "map");
        const suffix = query.toString();
        return suffix ? `/trial/${trial.id}?${suffix}` : `/trial/${trial.id}`;
      })()
    : "/profile";

  return (
    <div className="space-y-4">
      <div>
        <header className="relative -mx-5 -mt-5 overflow-hidden bg-lavender px-5 pb-9 pt-3">
          <Hills />
          <div className="relative flex min-h-11 items-center justify-between">
            <Link href={trialBack} className="-ml-2.5 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
              <CaretLeft size={20} weight="bold" />
              <span className="sr-only">Back</span>
            </Link>
            {optIn ? (
              <Link href={`/peers/settings?returnTo=${encodeURIComponent(here)}`} className="-mr-2 grid size-11 place-items-center rounded-full text-ink hover:bg-ink/5">
                <GearSix size={22} /><span className="sr-only">Matching settings</span>
              </Link>
            ) : null}
          </div>
        </header>
        <div className="relative z-10 -mt-8 flex items-center gap-3 rounded-[20px] border border-rule bg-surface px-3.5 py-3 shadow-[0_2px_10px_rgba(14,13,99,0.06)]">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-iris-soft text-iris">
            <HandHeart size={22} weight="fill" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-bold leading-snug tracking-[-0.01em] text-iris">Talk with someone like you</h1>
            <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">
              {trial ? `About this study` : "Same boat, same questions."}
            </p>
          </div>
        </div>
      </div>

      {trial ? (
        <p className="px-0.5 text-[12.5px] leading-snug text-ink-soft">{trial.briefTitle}</p>
      ) : null}

      {outcome.status === "not_opted_in" ? (
        <Card className="p-5 text-center">
          <span className="mx-auto mb-2.5 grid size-12 place-items-center rounded-full bg-lavender text-iris"><HandHeart size={24} weight="fill" /></span>
          <p className="text-[15px] font-bold text-ink">This is off until you turn it on</p>
          <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-ink-soft">
            Nobody can be matched with you, and you can&rsquo;t be found. You choose what may be compared,
            and you go by an alias.
          </p>
          <LinkButton href={`/peers/settings?returnTo=${encodeURIComponent(here)}`} className="mt-4 w-full">Choose what to share</LinkButton>
        </Card>
      ) : null}

      {outcome.status === "enrolled" ? (
        <Callout tone="caution" title="Not while you're taking part in this study">
          Once someone is in a study, comparing experiences with others in it can reveal which group
          a person is in and change what people report. So we don&rsquo;t pair people about a study they
          have joined. Your study team is the right place for questions now.
        </Callout>
      ) : null}

      {connections.length ? (
        <section aria-labelledby="conversations-heading">
          <SectionHeading id="conversations-heading">Your conversations</SectionHeading>
          <Card className="overflow-hidden">
            {connections.map((connection) => {
              const otherId = connection.fromId === participant.id ? connection.toId : connection.fromId;
              const other = getPeerOptIn(otherId);
              const incoming = connection.state === "pending" && connection.toId === participant.id;
              return (
                <Link key={connection.id} href={`/peers/${connection.id}`} className="flex items-center gap-3 border-b border-rule px-4 py-3 last:border-0 hover:bg-sunken">
                  <Avatar name={other?.alias ?? "?"} size="size-10 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-ink">{other?.alias ?? "Someone who has left"}</span>
                    <span className="block truncate text-[12px] text-ink-soft">{connection.trialId ? getTrial(connection.trialId)?.briefTitle : "General"}</span>
                  </span>
                  <Pill tone={incoming ? "blush" : STATE[connection.state].tone}>{incoming ? "Wants to talk" : STATE[connection.state].label}</Pill>
                  <CaretRight size={15} weight="bold" className="shrink-0 text-ink-faint" />
                </Link>
              );
            })}
          </Card>
        </section>
      ) : null}

      {outcome.status === "ok" ? (
        <section aria-labelledby="matches-heading">
          <h2 id="matches-heading" className="mb-2.5 text-[15px] font-bold tracking-[-0.01em] text-ink">Suggested for you</h2>
          <Suspense fallback={
            <Card className="flex items-center gap-3 p-4" >
              <Sparkle size={20} weight="fill" className="shrink-0 animate-pulse text-iris" />
              <p role="status" className="text-[13px] leading-relaxed text-ink-soft">
                <span className="font-bold text-ink">Comparing what you both chose to share.</span> Only the fields you and the other person both offered are looked at. This can take a few seconds the first time.
              </p>
            </Card>
          }>
            <Matches participantId={participant.id} trialId={trial?.id ?? null} />
          </Suspense>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The suggestions, streamed in because a language model may be ranking them.
 * The line above the list says who did the matching, model or rules, and what
 * it was allowed to look at.
 */
async function Matches({ participantId, trialId }: { participantId: string; trialId: string | null }) {
  const outcome = await findPeerMatchesSmart(participantId, trialId);
  if (outcome.status !== "ok") return null;
  const trial = trialId ? { id: trialId } : null;
  const byModel = outcome.matchedBy.kind === "model";
  return (
    <>
      <p className="mb-2.5 flex items-start gap-2 text-[12px] leading-relaxed text-ink-faint">
        {byModel ? <Sparkle size={15} weight="fill" className="mt-0.5 shrink-0 text-iris" /> : null}
        <span>
          {outcome.matchedBy.kind === "model"
            ? <>Matched by Meta AI ({outcome.matchedBy.model}). It was shown only the fields you and the other person <span className="font-semibold text-ink-soft">both</span> offered, with no names or contact details, and every reason below was checked against them.</>
            : <>{outcome.matchedBy.why} Only fields you both offered are compared.</>}
        </span>
      </p>
      {outcome.matches.length === 0 ? (
            <Empty title="Nobody close enough right now" icon={<UsersThree size={22} />}>
              Offering a little more in your settings can help. We would rather suggest nobody than a poor match.
            </Empty>
          ) : (
            <ul className="space-y-2.5">
              {outcome.matches.map((match) => (
                <Card as="li" key={match.participantId} className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={match.alias} size="size-12 text-sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-ink">{match.alias}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1.5">
                        <Pill tone={match.strength === "strong" ? "mint" : "iris"}>{match.strength === "strong" ? "A lot in common" : "Some things in common"}</Pill>
                        {match.sameStudy ? <Pill tone="peach">Looking at this study too</Pill> : null}
                      </div>
                    </div>
                  </div>
                  {match.about ? <p className="mt-2.5 rounded-[14px] bg-lavender px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">&ldquo;{match.about}&rdquo;</p> : null}
                  <ul className="mt-2.5 space-y-1">
                    {match.reasons.map((reason) => <li key={reason} className="text-[12.5px] leading-snug text-ink-soft">{reason}</li>)}
                  </ul>
                  <form action={requestPeerAction} className="mt-3 space-y-2">
                    <input type="hidden" name="toId" value={match.participantId} />
                    <input type="hidden" name="trialId" value={trial?.id ?? ""} />
                    <label className="block text-[12px] font-semibold text-ink-soft">
                      Add a note (optional)
                      <input name="note" maxLength={240} placeholder="Say hello in your own words" className="mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-faint" />
                    </label>
                    <button type="submit" className="min-h-12 w-full rounded-full border border-iris bg-iris-soft text-[14px] font-bold text-iris-deep hover:bg-iris hover:text-white">
                      Ask {match.alias} to talk
                    </button>
                  </form>
                </Card>
              ))}
            </ul>
          )}
    </>
  );
}
