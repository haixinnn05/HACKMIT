import { HandHeart } from "@phosphor-icons/react/dist/ssr";
import { Callout, Card, ScreenHeader } from "@/components/ui";
import { getPeerOptIn } from "@/lib/peer-repo";
import { PEER_FIELDS } from "@/lib/peers";
import { getActiveParticipant } from "@/lib/session";
import { savePeerOptInAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function PeerSettingsPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const participant = await getActiveParticipant();
  const optIn = getPeerOptIn(participant.id);
  const input = "mt-1 min-h-12 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[14px] text-ink placeholder:text-ink-faint";

  return (
    <div className="space-y-4">
      <ScreenHeader back="/peers" title="Talking with others" sub="You decide whether you can be matched, and on what." />

      <Callout icon={<HandHeart size={20} weight="fill" />} title="How matching uses this">
        We only compare a kind of information when both of you have ticked it. Nobody can browse
        people, and the other person sees your alias and what you have in common. Nothing else.
      </Callout>

      <form action={savePeerOptInAction} className="space-y-4">
        <input type="hidden" name="returnTo" value={returnTo ?? "/peers"} />
        <Card className="space-y-3 p-4">
          <label className="block text-[12.5px] font-semibold text-ink">
            What should we call you?
            <input name="alias" required maxLength={24} defaultValue={optIn?.alias ?? participant.displayName.split(" ")[0]} className={input} />
            <span className="mt-1 block text-[11.5px] font-normal text-ink-faint">A first name or a nickname. Your full name is never shown.</span>
          </label>
          <label className="block text-[12.5px] font-semibold text-ink">
            A line about you (optional)
            <input name="about" maxLength={160} defaultValue={optIn?.about ?? ""} placeholder="What would you want someone to know?" className={input} />
          </label>
        </Card>

        <Card className="p-4">
          <p className="text-[14px] font-bold text-ink">What may be compared</p>
          <p className="mb-1 text-[12.5px] leading-relaxed text-ink-soft">Tick only what you&rsquo;re comfortable having in common with someone.</p>
          {PEER_FIELDS.map((field) => (
            <label key={field.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-rule py-1.5 last:border-0">
              <input type="checkbox" name="offer" value={field.id} defaultChecked={optIn ? optIn.offers.includes(field.id) : field.id === "condition"} className="size-5 shrink-0 accent-[#5e44fb]" />
              <span className="text-[13.5px] text-ink">{field.label}</span>
            </label>
          ))}
        </Card>

        <button type="submit" name="intent" value="save" className="cta min-h-12 w-full rounded-full text-[15px] font-bold text-white">
          {optIn ? "Save changes" : "Turn on matching"}
        </button>
        {optIn ? (
          <button type="submit" name="intent" value="leave" formNoValidate className="min-h-12 w-full rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-blush">
            Turn off and end my conversations
          </button>
        ) : null}
      </form>
    </div>
  );
}
