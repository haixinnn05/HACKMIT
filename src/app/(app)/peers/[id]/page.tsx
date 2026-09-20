import { notFound } from "next/navigation";
import { Flag, PaperPlaneRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { Avatar, Callout, Card, Pill, ScreenHeader } from "@/components/ui";
import { suggestAgenda } from "@/lib/peer-agenda";
import { getPeerConnection, getPeerOptIn, listPeerMessages } from "@/lib/peer-repo";
import { getTrial } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { respondPeerAction, sendPeerMessageAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * One peer conversation. Both people go by an alias, and see only the overlaps
 * that made the match. Either can end it or report it at any time.
 */
export default async function PeerConversationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> }) {
  const { id } = await params;
  const { draft } = await searchParams;
  const participant = await getActiveParticipant();
  const connection = getPeerConnection(id);
  // Authorization: a conversation is readable only by the two people in it.
  if (!connection || (connection.fromId !== participant.id && connection.toId !== participant.id)) notFound();

  const otherId = connection.fromId === participant.id ? connection.toId : connection.fromId;
  const other = getPeerOptIn(otherId);
  const alias = other?.alias ?? "Someone who has left";
  const trial = connection.trialId ? getTrial(connection.trialId) : null;
  const incoming = connection.state === "pending" && connection.toId === participant.id;
  const messages = listPeerMessages(connection.id);
  const agenda = connection.state === "accepted" ? await suggestAgenda({ reasons: connection.reasons, studyTitle: trial?.briefTitle ?? null }) : null;
  const here = `/peers/${connection.id}`;

  return (
    <div className="space-y-4">
      <ScreenHeader back="/peers" title={alias} sub={trial ? `About: ${trial.briefTitle}` : "A general conversation"} />

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Avatar name={alias} size="size-11 text-sm" />
          <div>
            <p className="text-[13px] font-bold text-ink">What you have in common</p>
            <p className="text-[11.5px] text-ink-faint">Only what you both chose to offer.</p>
          </div>
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {connection.reasons.map((reason) => <li key={reason}><Pill tone="iris">{reason}</Pill></li>)}
        </ul>
      </Card>

      {connection.state === "pending" ? (
        incoming ? (
          <Card className="space-y-3 p-4">
            <p className="text-[14.5px] font-bold text-ink">{alias} would like to talk</p>
            {connection.note ? <p className="rounded-[14px] bg-lavender px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">&ldquo;{connection.note}&rdquo;</p> : null}
            <p className="text-[12.5px] leading-relaxed text-ink-soft">Saying no is fine, and they aren&rsquo;t told why. You stay anonymous either way.</p>
            <form action={respondPeerAction} className="flex gap-2">
              <input type="hidden" name="connectionId" value={connection.id} />
              <button type="submit" name="intent" value="decline" className="min-h-12 flex-1 rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-ink">Not now</button>
              <button type="submit" name="intent" value="accept" className="cta min-h-12 flex-1 rounded-full text-[14px] font-bold text-white">Yes, let&rsquo;s talk</button>
            </form>
          </Card>
        ) : (
          <Callout title={`Waiting for ${alias}`}>They will see your request next time they open Mozaic. There is no rush on either side.</Callout>
        )
      ) : null}

      {["declined", "ended", "reported"].includes(connection.state) ? (
        <Callout tone="neutral" title="This conversation is closed">
          {connection.state === "reported" ? "It was reported and closed. Thank you for telling us." : "No more messages can be sent. Nothing else about you was shared."}
        </Callout>
      ) : null}

      {connection.state === "accepted" ? (
        <>
          <Callout title="A few ground rules">
            Good to share: how you&rsquo;re deciding, travel and time, what you asked the study team. Please
            don&rsquo;t compare symptoms as medical advice, guess which treatment group anyone is in, or
            recommend a treatment. Medical questions go to the study team.
          </Callout>

          {messages.length === 0 && agenda ? (
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-ink"><Sparkle size={16} weight="fill" className="text-iris" /> Not sure how to start?</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">{agenda.source}</p>
              <ul className="mt-2.5 space-y-2">
                {[agenda.opener, ...agenda.topics].map((line) => (
                  <li key={line}>
                    <a href={`${here}?draft=${encodeURIComponent(line)}#compose`} className="block rounded-[14px] border border-rule px-3.5 py-2.5 text-[13px] leading-snug text-ink hover:border-iris">
                      {line}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-ink-faint">Tap one to put it in the box below. Nothing is sent until you send it.</p>
            </Card>
          ) : null}

          <ol className="space-y-2">
            {messages.map((message) => {
              const mine = message.senderId === participant.id;
              return (
                <li key={message.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <p className={`max-w-[85%] rounded-[18px] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${mine ? "rounded-br-[6px] bg-iris text-white" : "rounded-bl-[6px] border border-rule bg-surface text-ink"}`}>
                    {message.text}
                  </p>
                  {message.reminder ? (
                    <p className="mt-1 max-w-[85%] text-[11px] leading-snug text-peach">
                      A reminder: treatment groups, doses and side effects are best taken to the study team.
                    </p>
                  ) : null}
                  <span className="mt-0.5 text-[10.5px] text-ink-faint">{mine ? "You" : alias}, {new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                </li>
              );
            })}
          </ol>

          <form id="compose" action={sendPeerMessageAction} className="scroll-mt-6 space-y-2">
            <input type="hidden" name="connectionId" value={connection.id} />
            <label className="block text-[12px] font-semibold text-ink-soft">
              Your message
              <textarea key={draft ?? ""} name="text" required rows={3} maxLength={800} defaultValue={draft ?? ""}
                className="mt-1 w-full rounded-[16px] border border-rule bg-surface px-3.5 py-2.5 text-[14px] text-ink" />
            </label>
            <button type="submit" className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
              <PaperPlaneRight size={17} weight="bold" /> Send
            </button>
          </form>

          <form action={respondPeerAction} className="flex gap-2 pt-1">
            <input type="hidden" name="connectionId" value={connection.id} />
            <button type="submit" name="intent" value="end" className="min-h-11 flex-1 rounded-full border border-rule-strong bg-surface text-[13px] font-bold text-ink">End conversation</button>
            <button type="submit" name="intent" value="report" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-rule-strong bg-surface text-[13px] font-bold text-blush">
              <Flag size={15} weight="fill" /> Report
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
