import { CalendarCheck, Check, CheckCircle, HandWaving, Question, XCircle } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { RevealOnChange } from "@/components/RevealOnChange";
import {
  coordinatorAcknowledgeAction, coordinatorInviteAction, coordinatorNotProceedingAction, coordinatorReopenAction, coordinatorRequestInfoAction,
} from "@/app/actions";
import type { Inquiry } from "@/lib/types";

/**
 * Where an inquiry stands, and what the coordinator can do next.
 *
 * It sits at the top of the review screen because it answers the two questions a
 * coordinator has on opening one: what state is this in, and what do I do with
 * it. Every action changes what is shown here, so a tap is never left looking
 * like it did nothing.
 *
 * The outcomes are next steps, not verdicts. "Invite to a screening call" is the
 * yes; there is no "accept" or "enrol", because eligibility is decided at
 * screening, with the study team, and not in this app.
 */

/**
 * Each step is ticked only if it happened. An inquiry closed without a reply
 * does not get a tick for a conversation nobody had.
 */
function steps(state: Inquiry["state"], replied: boolean): { label: string; done: boolean }[] {
  const ended = state === "invited" || state === "closed";
  return [
    { label: "Received", done: state !== "shared" && state !== "draft" },
    { label: "In conversation", done: replied || state === "needs_information" || state === "answered" },
    { label: state === "invited" ? "Invited" : state === "closed" ? "Closed" : "Next step", done: ended },
  ];
}

const SUMMARY: Record<Inquiry["state"], { title: string; body: string; tone: string; icon: React.ReactNode }> = {
  draft: { title: "Draft", body: "Not shared yet.", tone: "bg-sunken text-ink", icon: <Question size={20} weight="fill" /> },
  shared: { title: "New. Not acknowledged yet", body: "The participant sees this as waiting. Acknowledge it so they know it reached a person.", tone: "bg-peach-soft text-peach", icon: <HandWaving size={20} weight="fill" /> },
  acknowledged: { title: "Received", body: "The participant can see that a coordinator has their inquiry. Choose a next step when you are ready.", tone: "bg-iris-soft text-iris-deep", icon: <CheckCircle size={20} weight="fill" /> },
  needs_information: { title: "Waiting on the participant", body: "You asked them for something. They see your note in their inbox.", tone: "bg-peach-soft text-peach", icon: <Question size={20} weight="fill" /> },
  answered: { title: "In conversation", body: "You have sent at least one answer. Choose a next step, or keep answering.", tone: "bg-iris-soft text-iris-deep", icon: <CheckCircle size={20} weight="fill" /> },
  invited: { title: "Invited to a screening call", body: "They have been invited to talk. Screening decides eligibility, not this app.", tone: "bg-mint-soft text-mint", icon: <CalendarCheck size={20} weight="fill" /> },
  closed: { title: "Closed", body: "This inquiry is not moving forward. The participant can read the reason below.", tone: "bg-sunken text-ink-soft", icon: <XCircle size={20} weight="fill" /> },
};

export function InquiryStatusPanel({ inquiry, firstName, replied }: { inquiry: Inquiry; firstName: string; replied: boolean }) {
  const summary = SUMMARY[inquiry.state];
  const open = inquiry.state !== "closed" && inquiry.state !== "invited";
  const input = "mt-1 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-faint";
  const hidden = <input type="hidden" name="inquiryId" value={inquiry.id} />;

  return (
    <Card id="inquiry-status" className="scroll-mt-28 overflow-hidden">
      <RevealOnChange targetId="inquiry-status" value={inquiry.state} />
      <div className={`flex items-start gap-3 px-4 py-3.5 ${summary.tone}`} role="status" aria-live="polite">
        <span className="mt-0.5 shrink-0">{summary.icon}</span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold text-ink">{summary.title}</p>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">{summary.body}</p>
          <p className="mt-1 text-[11px] text-ink-faint">Last updated {new Date(inquiry.updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
        </div>
      </div>

      <ol className="grid grid-cols-3 border-b border-rule px-4 py-3">
        {steps(inquiry.state, replied).map(({ label, done }, index) => {
          return (
            <li key={label} className="flex flex-col items-center gap-1 text-center">
              <span className={`grid size-6 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-iris text-white" : "border-2 border-dashed border-rule-strong text-ink-faint"}`}>
                {done ? <Check size={13} weight="bold" /> : index + 1}
              </span>
              <span className={`text-[11px] leading-tight ${done ? "font-bold text-ink" : "text-ink-faint"}`}>
                {label}<span className="sr-only">{done ? ", done" : ", not yet"}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {inquiry.coordinatorNote && !open ? (
        <p className="border-b border-rule px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          <span className="font-bold text-ink">What {firstName} was told: </span>{inquiry.coordinatorNote}
        </p>
      ) : null}

      {!open ? (
        <form action={coordinatorReopenAction} className="p-4">
          {hidden}
          <button type="submit" className="min-h-12 w-full rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-ink hover:bg-sunken">
            Reopen this inquiry
          </button>
          <p className="mt-2 text-center text-[11.5px] text-ink-faint">{firstName} is told when a conversation is reopened.</p>
        </form>
      ) : null}

      {open ? (
        <div className="space-y-2.5 p-4">
          {inquiry.state === "shared" ? (
            <form action={coordinatorAcknowledgeAction}>
              {hidden}
              <button type="submit" className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14.5px] font-bold text-white">
                <CheckCircle size={18} weight="bold" /> Acknowledge receipt
              </button>
            </form>
          ) : null}

          <details className="group rounded-[16px] border border-rule">
            <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-[16px] px-4 text-[14px] font-bold ${inquiry.state === "shared" ? "text-ink" : "cta text-white"}`}>
              <CalendarCheck size={18} weight="bold" /> Invite {firstName} to a screening call
            </summary>
            <form action={coordinatorInviteAction} className="space-y-2.5 p-3.5">
              {hidden}
              <p className="text-[12px] leading-relaxed text-ink-soft">
                An invitation to talk. It is not an eligibility decision and it does not enrol anyone. Screening does that.
              </p>
              <label className="block text-[12px] font-semibold text-ink-soft">
                Message to {firstName} (optional)
                <textarea name="note" rows={3} maxLength={400} placeholder="e.g. We have openings Tuesday and Thursday mornings. Reply here or call 555-0100."
                  className={`${input} py-2.5`} />
              </label>
              <button type="submit" className="cta min-h-12 w-full rounded-full text-[14px] font-bold text-white">Send invitation</button>
            </form>
          </details>

          <details className="rounded-[16px] border border-rule">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 px-4 text-[14px] font-bold text-ink">
              <Question size={18} weight="bold" /> Ask {firstName} for information
            </summary>
            <form action={coordinatorRequestInfoAction} className="space-y-2.5 p-3.5">
              {hidden}
              <label className="block text-[12px] font-semibold text-ink-soft">
                What do you need?
                <input name="note" required maxLength={300} placeholder="e.g. We would need your HER2 result before screening." className={`${input} min-h-12`} />
              </label>
              <button type="submit" className="min-h-12 w-full rounded-full border border-iris bg-iris-soft text-[14px] font-bold text-iris-deep hover:bg-iris hover:text-white">Send request</button>
            </form>
          </details>

          <details className="rounded-[16px] border border-rule">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 px-4 text-[14px] font-bold text-ink-soft">
              <XCircle size={18} weight="bold" /> Not moving forward
            </summary>
            <form action={coordinatorNotProceedingAction} className="space-y-2.5 p-3.5">
              {hidden}
              <p className="text-[12px] leading-relaxed text-ink-soft">
                {firstName} will be able to read the reason. Nobody should be left wondering why a conversation stopped.
              </p>
              <label className="block text-[12px] font-semibold text-ink-soft">
                Reason
                <select name="reason" defaultValue="not_enrolling" className={`${input} min-h-12`}>
                  <option value="not_enrolling">Not enrolling at this site right now</option>
                  <option value="outside_criteria">Looks outside this study&rsquo;s criteria</option>
                  <option value="logistics">Visits or travel cannot be made to work</option>
                  <option value="other">Another reason</option>
                </select>
              </label>
              <label className="block text-[12px] font-semibold text-ink-soft">
                Anything to add (optional)
                <input name="note" maxLength={300} placeholder="e.g. We expect to reopen in the spring." className={`${input} min-h-12`} />
              </label>
              <button type="submit" className="min-h-12 w-full rounded-full border border-rule-strong bg-surface text-[14px] font-bold text-blush hover:bg-blush-soft">Close this inquiry</button>
            </form>
          </details>
        </div>
      ) : null}
    </Card>
  );
}
