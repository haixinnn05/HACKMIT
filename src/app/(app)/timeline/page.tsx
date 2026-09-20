import { Check } from "@phosphor-icons/react/dist/ssr";
import { Card, Empty, LinkButton, ScreenHeader, SectionHeading, Tabs } from "@/components/ui";
import { requestNow } from "@/lib/clock";
import { openedFromMap } from "@/lib/map-return";
import { listEnrollments, listTodos } from "@/lib/repo";
import { getActiveParticipant } from "@/lib/session";
import { requestVisitHelpAction, toggleTodoAction } from "@/app/actions";

export const dynamic = "force-dynamic";

/**
 * Visits & Timeline, for studies the person has said yes to.
 *
 * Dates come only from a site-confirmed schedule. A study without one produces
 * no entries here, because an invented date is an invented commitment. Clock
 * times are not shown for the same reason: the fixture confirms visit length,
 * not appointment slots.
 */
export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ view?: string; from?: string }> }) {
  const { view: rawView, from } = await searchParams;
  const view = rawView === "calendar" ? "calendar" : "timeline";
  const fromMap = openedFromMap(from);
  const timelineHref = fromMap ? "/timeline?from=map" : "/timeline";
  const calendarHref = fromMap ? "/timeline?view=calendar&from=map" : "/timeline?view=calendar";
  const participant = await getActiveParticipant();
  const now = requestNow();
  const today = new Date(now).toISOString().slice(0, 10);

  const active = listEnrollments(participant.id).filter((entry) => entry.status === "participating");
  const visits = active
    .flatMap((entry) => entry.visits.map((visit) => ({ ...visit, trialId: entry.trialId })))
    .sort((a, b) => a.date.localeCompare(b.date));
  const todos = listTodos(participant.id);
  const nextVisit = visits.find((visit) => visit.date >= today);

  return (
    <div className="space-y-4">
      <ScreenHeader art title="Visits & Timeline" back={fromMap ? "/" : undefined} />

      <Tabs
        variant="segment" current={view}
        tabs={[
          { id: "timeline", label: "Timeline", href: timelineHref },
          { id: "calendar", label: "Calendar", href: calendarHref },
        ]}
      />

      {visits.length === 0 ? (
        <Empty title="No visits yet">
          <LinkButton href="/explore" variant="secondary" className="mt-3.5">Find trials</LinkButton>
        </Empty>
      ) : (
        <>
          {view === "timeline" ? (
            <ol className="relative ml-2 border-l-2 border-iris/30 pl-6">
              {visits.map((visit, index) => {
                const date = new Date(`${visit.date}T09:00:00`);
                const past = visit.date < today;
                return (
                  <li key={`${visit.trialId}-${index}`} className="relative pb-2.5 last:pb-0">
                    <span aria-hidden className={`absolute -left-[33px] top-5 size-3.5 rounded-full border-2 border-canvas ${past ? "bg-rule-strong" : "bg-iris"}`} />
                    <Card id={`visit-${visit.trialId}-${index}`} className={`scroll-mt-4 px-4 py-3 target:ring-2 target:ring-iris ${past ? "opacity-60" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-[12px] text-ink-soft">{date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{past ? " (past)" : ""}</p>
                        <p className="text-[14.5px] font-bold text-ink">{visit.name}</p>
                        {visit.location ? <p className="text-[12.5px] text-ink-soft">{visit.location.split(",")[0]}</p> : null}
                        <p className="text-[12.5px] text-ink-soft">About {visit.onSiteHours} hours. Time to be confirmed.</p>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          ) : (
            <CalendarView visits={visits} today={today} />
          )}
        </>
      )}

      {todos.length ? (
        <section aria-labelledby="todo-heading">
          <SectionHeading id="todo-heading">To Do</SectionHeading>
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li key={todo.id}>
                <form action={toggleTodoAction}>
                  <input type="hidden" name="todoId" value={todo.id} />
                  <button type="submit" role="checkbox" aria-checked={todo.done}
                    className="press flex min-h-13 w-full items-center gap-3 rounded-[14px] border border-rule bg-surface px-3.5 py-3 text-left">
                    <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-[8px] border-2 ${todo.done ? "border-iris bg-iris text-white" : "border-rule-strong text-transparent"}`}>
                      <Check size={14} weight="bold" />
                    </span>
                    <span className={`text-[13.5px] font-semibold ${todo.done ? "text-ink-faint line-through" : "text-ink"}`}>{todo.label}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {nextVisit ? (
        <Card className="p-4">
          <form action={requestVisitHelpAction} className="space-y-2.5">
            <input type="hidden" name="trialId" value={nextVisit.trialId} />
            <label htmlFor="visit-help" className="block text-[14px] font-bold text-ink">Is anything making your next visit difficult?</label>
            <textarea id="visit-help" name="text" rows={2} required placeholder="e.g. I do not have a ride on that day."
              className="w-full rounded-[14px] border border-rule bg-surface px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-faint" />
            <button type="submit" className="press min-h-11 rounded-full border border-rule-strong bg-surface px-5 text-[13px] font-bold text-ink hover:bg-sunken">Ask for help</button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

function CalendarView({ visits, today }: { visits: { name: string; date: string }[]; today: string }) {
  const months = [...new Set(visits.map((visit) => visit.date.slice(0, 7)))];
  const byDate = new Map(visits.map((visit) => [visit.date, visit.name]));

  return (
    <div className="space-y-4">
      {months.map((month) => {
        const [year, m] = month.split("-").map(Number);
        const first = new Date(year, m - 1, 1);
        const days = new Date(year, m, 0).getDate();
        const cells = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
        return (
          <Card key={month} className="p-4">
            <p className="mb-2 text-[14px] font-bold text-ink">{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
            <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-ink-faint">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={index}>{day}</span>)}
              {cells.map((day, index) => {
                if (day == null) return <span key={index} />;
                const iso = `${month}-${String(day).padStart(2, "0")}`;
                const visit = byDate.get(iso);
                return (
                  <span key={index} title={visit}
                    className={`mx-auto grid size-9 place-items-center rounded-full text-[12.5px] ${
                      visit ? "bg-iris font-bold text-white" : iso === today ? "border border-iris font-bold text-ink" : "text-ink-soft"
                    }`}>
                    {day}{visit ? <span className="sr-only">: {visit}</span> : null}
                  </span>
                );
              })}
            </div>
            <ul className="mt-3 space-y-1 border-t border-rule pt-2.5">
              {visits.filter((visit) => visit.date.startsWith(month)).map((visit) => (
                <li key={visit.date} className="flex justify-between gap-3 text-[12.5px]">
                  <span className="font-semibold text-ink">{visit.name}</span>
                  <span className="text-ink-soft">{new Date(`${visit.date}T09:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
