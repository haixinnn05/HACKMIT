import Link from "next/link";
import { CalendarBlank, CaretRight, ChatCircleText, CheckCircle, Pause, Play, Plus, Trash, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { Card, Pill, ScreenHeader, SectionHeading } from "@/components/ui";
import { getTrial, listInquiriesForCoordinator, listSavedReplies, listSiteStudies } from "@/lib/repo";
import { addSavedReplyAction, deleteSavedReplyAction, removeStudyAction, setStudyRecruitingAction } from "@/app/actions";

export const dynamic = "force-dynamic";

const SITE_STUDY = "TP-FIX-001";

/**
 * Studies: what this site runs, and its library of reusable replies.
 *
 * Logistics questions repeat across participants, so an answer written once can
 * start the next reply. A saved reply is only ever offered as a draft in the
 * inbox. A person still reads, edits and sends it, and it is never sent
 * automatically.
 */
export default async function StudiesPage({ searchParams }: { searchParams: Promise<{ posted?: string; kept?: string }> }) {
  const { posted, kept } = await searchParams;
  const trial = getTrial(SITE_STUDY);
  if (!trial) return null;
  const inquiries = listInquiriesForCoordinator();
  const postedStudies = listSiteStudies().filter((study) => study.id !== SITE_STUDY);
  const justPosted = posted ? postedStudies.find((study) => study.id === posted) : null;
  const replies = listSavedReplies(SITE_STUDY);
  const interest = inquiries.filter((inquiry) => inquiry.trialId === SITE_STUDY).length;
  const schedule = trial.visitSchedule;
  const input = "mt-1 w-full rounded-[14px] border border-rule bg-surface px-3.5 text-[13.5px] text-ink placeholder:text-ink-faint";

  return (
    <div className="space-y-4">
      <ScreenHeader title="Studies" sub="The studies your site runs, and the replies you reuse." />

      {justPosted ? (
        <p role="status" className="flex items-start gap-2.5 rounded-[16px] bg-mint-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
          <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-mint" />
          <span><span className="font-bold">Posted.</span> Participants can now find &ldquo;{justPosted.briefTitle}&rdquo; and send you an inquiry.{" "}
            <Link href={`/trial/${justPosted.id}`} className="font-bold text-iris-deep underline">See it as they do</Link>
          </span>
        </p>
      ) : null}
      {kept ? (
        <p role="alert" className="rounded-[16px] bg-peach-soft px-4 py-3 text-[13px] leading-relaxed text-ink">
          <span className="font-bold">Not removed.</span> Someone has an inquiry on that study. Pause recruiting instead, so their conversation stays intact.
        </p>
      ) : null}

      <Link href="/clinic/studies/new" className="cta press inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white">
        <Plus size={18} weight="bold" /> Post a study
      </Link>

      {postedStudies.length ? (
        <section aria-labelledby="posted-heading">
          <SectionHeading id="posted-heading" hint="Visible to participants in Find Clinical Trials. Pausing keeps the page readable but marks it as not recruiting.">
            Posted by your team ({postedStudies.length})
          </SectionHeading>
          <ul className="space-y-2.5">
            {postedStudies.map((study) => {
              const count = inquiries.filter((inquiry) => inquiry.trialId === study.id).length;
              const recruiting = study.overallStatus === "RECRUITING";
              return (
                <Card as="li" key={study.id} className="overflow-hidden">
                  <Link href={`/trial/${study.id}`} className="press flex items-start gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-bold leading-snug text-ink">{study.briefTitle}</span>
                      <span className="mt-0.5 block font-mono text-[11.5px] text-ink-faint">{study.id} · posted {study.studyFirstPostDate}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <Pill tone={recruiting ? "mint" : "peach"}>{study.overallStatus?.toLowerCase().replace(/_/g, " ")}</Pill>
                        <Pill tone="iris" icon={<UsersThree size={12} weight="fill" />}>{count} {count === 1 ? "inquiry" : "inquiries"}</Pill>
                        <Pill>{study.criteria.length} requirements</Pill>
                        {study.visitSchedule ? <Pill>{study.visitSchedule.visits.length} visits</Pill> : <Pill>schedule not given</Pill>}
                      </span>
                    </span>
                    <CaretRight size={16} weight="bold" className="mt-1 shrink-0 text-iris" />
                  </Link>
                  <div className="flex border-t border-rule">
                    <form action={setStudyRecruitingAction} className="flex-1">
                      <input type="hidden" name="studyId" value={study.id} />
                      <input type="hidden" name="recruiting" value={recruiting ? "0" : "1"} />
                      <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-1.5 text-[13px] font-bold text-ink hover:bg-sunken">
                        {recruiting ? <><Pause size={15} weight="bold" /> Pause recruiting</> : <><Play size={15} weight="bold" /> Resume recruiting</>}
                      </button>
                    </form>
                    <form action={removeStudyAction} className="flex-1 border-l border-rule">
                      <input type="hidden" name="studyId" value={study.id} />
                      <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-1.5 text-[13px] font-bold text-blush hover:bg-blush-soft">
                        <Trash size={15} weight="bold" /> Remove
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </ul>
        </section>
      ) : null}

      <SectionHeading>Your main study</SectionHeading>

      <Card className="p-4">
        <p className="text-[14.5px] font-bold leading-snug text-ink">{trial.briefTitle}</p>
        <p className="mt-0.5 font-mono text-[11.5px] text-ink-faint">{trial.id}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill tone="mint">{trial.overallStatus?.toLowerCase()}</Pill>
          <Pill tone="iris" icon={<UsersThree size={12} weight="fill" />}>{interest} active {interest === 1 ? "inquiry" : "inquiries"}</Pill>
          <Pill>{trial.enrollmentCount} planned</Pill>
        </div>
      </Card>

      {schedule ? (
        <section>
          <SectionHeading hint="This is what participants see in their Participation Preview. Keeping it accurate is what makes their estimate honest.">
            Visit schedule you confirmed
          </SectionHeading>
          <Card className="px-4">
            {schedule.visits.map((visit) => (
              <div key={visit.name} className="flex items-start gap-3 border-b border-rule py-3 last:border-0">
                <CalendarBlank size={18} className="mt-0.5 shrink-0 text-iris" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-ink">{visit.name}</p>
                  <p className="text-[12px] text-ink-soft">{visit.procedures.join(", ")}</p>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-ink-soft">week {visit.weekOffset}, {visit.onSiteHours}h</span>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">Confirmed {schedule.confirmedOn}. {schedule.notes}</p>
        </section>
      ) : null}

      <section aria-labelledby="replies-heading">
        <SectionHeading id="replies-heading" hint="Offered as a starting draft when a question contains one of the keywords. Never sent without a person editing and sending it.">
          Saved replies ({replies.length})
        </SectionHeading>
        <ul className="space-y-2.5">
          {replies.map((reply) => (
            <Card as="li" key={reply.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">{reply.keywords.map((keyword) => <Pill key={keyword} tone="iris">{keyword}</Pill>)}</div>
                <form action={deleteSavedReplyAction}>
                  <input type="hidden" name="replyId" value={reply.id} />
                  <button type="submit" className="-mr-2 -mt-2 grid size-11 place-items-center rounded-full text-ink-faint hover:bg-blush-soft hover:text-blush">
                    <Trash size={17} /><span className="sr-only">Delete this saved reply</span>
                  </button>
                </form>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{reply.answer}</p>
              {reply.citation ? <p className="mt-1.5 text-[11.5px] text-ink-faint">{reply.citation}</p> : null}
            </Card>
          ))}
        </ul>

        <Card className="mt-2.5 p-4">
          <form action={addSavedReplyAction} className="space-y-3">
            <input type="hidden" name="trialId" value={SITE_STUDY} />
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink"><ChatCircleText size={18} className="text-iris" /> Save a new reply</p>
            <label className="block text-[12px] font-semibold text-ink-soft">
              Keywords, separated by commas
              <input name="keywords" required placeholder="childcare, children, kids" className={`${input} min-h-12`} />
            </label>
            <label className="block text-[12px] font-semibold text-ink-soft">
              The reply
              <textarea name="answer" required rows={3} placeholder="What you would tell the next person who asks." className={`${input} py-2.5`} />
            </label>
            <label className="block text-[12px] font-semibold text-ink-soft">
              Where it comes from
              <input name="citation" placeholder="e.g. Site policy, confirmed today" className={`${input} min-h-12`} />
            </label>
            <button type="submit" className="min-h-12 w-full rounded-full border border-iris bg-iris-soft text-[14px] font-bold text-iris-deep hover:bg-iris hover:text-white">Save reply</button>
          </form>
        </Card>
      </section>
    </div>
  );
}
