"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "@phosphor-icons/react";
import { toggleTodoAction } from "@/app/actions";
import { withMapReturn } from "@/lib/map-return";

export type JourneyDetail = {
  note?: string;
  facts?: { label: string; value: string }[];
  items?: { id?: string; label: string; done?: boolean }[];
  moreHref?: string;
  moreLabel?: string;
};

export type JourneyStop = {
  id: string;
  title: string;
  sub?: string;
  href: string;
  done: boolean;
  detail?: JourneyDetail;
};

const SIDE_DOODLES = ["tree", "birds", "bush", "flower", "tree"] as const;

const TIMELINE_LIST = "/timeline?view=timeline&from=map";

/**
 * A top-to-bottom board-game path. Stops alternate left and right, joined by a
 * dotted trail, so the next thing to do reads as a place on a map. Study stops
 * open a card for that step; Full timeline opens the visit list.
 */
export function JourneyMap({ stops, startAt = 1 }: { stops: JourneyStop[]; startAt?: number }) {
  const router = useRouter();
  const currentIndex = stops.findIndex((stop) => !stop.done);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const selected = stops.find((stop) => stop.id === openId) ?? null;

  useEffect(() => {
    setTicked({});
  }, [openId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenId(null);
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  const itemDone = (item: { id?: string; done?: boolean }) =>
    item.id && item.id in ticked ? ticked[item.id] : Boolean(item.done);

  const toggleItem = (id: string, currentlyDone: boolean) => {
    setTicked((current) => ({ ...current, [id]: !currentlyDone }));
    const data = new FormData();
    data.set("todoId", id);
    startTransition(async () => {
      await toggleTodoAction(data);
      router.refresh();
    });
  };

  const openTimelineList = () => {
    const hash = selected?.href.includes("#") ? selected.href.slice(selected.href.indexOf("#")) : "";
    router.push(`${TIMELINE_LIST}${hash}`);
  };

  return (
    <>
      <ol className="relative">
        {stops.map((stop, index) => {
          const left = index % 2 === 0;
          const current = index === currentIndex;
          const cardClass = `press relative block w-full rounded-[20px] border bg-surface px-4 pb-4 pt-3.5 text-left shadow-[0_2px_10px_rgba(14,13,99,0.04)] ${
            current
              ? "border-iris ring-4 ring-iris/15"
              : stop.done
                ? "border-rule"
                : "border-dashed border-rule-strong"
          }`;
          const inner = (
            <>
              <span
                aria-hidden
                className={`mb-2.5 grid size-8 place-items-center rounded-full text-[13px] font-bold ${
                  stop.done
                    ? "bg-iris text-white"
                    : current
                      ? "bg-iris text-white"
                      : "border-2 border-dashed border-rule-strong bg-sunken text-ink-faint"
                }`}
              >
                {stop.done ? <Check size={15} weight="bold" /> : startAt + index}
              </span>
              <p className={`text-[15px] font-bold leading-snug ${current ? "text-iris-deep" : "text-ink"}`}>
                {stop.title}
              </p>
              {stop.sub ? (
                <p className="mt-0.5 text-[12.5px] leading-snug text-ink-soft">{stop.sub}</p>
              ) : null}
              <span className="sr-only">
                {stop.done ? ", done" : current ? ", up next" : ", later"}
              </span>
            </>
          );
          return (
            <li key={stop.id} className="relative">
              {index > 0 ? (
                <PathBend
                  toRight={left}
                  filled={stops[index - 1].done}
                  bird={index === 1 || index === 4}
                />
              ) : null}
              <article className={`w-[70%] ${left ? "" : "ml-auto"}`}>
                {stop.detail ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-current={current ? "step" : undefined}
                    suppressHydrationWarning
                    onClick={() => setOpenId(stop.id)}
                    className={cardClass}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    href={withMapReturn(stop.href)}
                    aria-current={current ? "step" : undefined}
                    suppressHydrationWarning
                    className={cardClass}
                  >
                    {inner}
                  </Link>
                )}
              </article>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-8 ${left ? "right-0" : "left-0"}`}
              >
                <MapDoodle kind={SIDE_DOODLES[index % SIDE_DOODLES.length]} />
              </span>
            </li>
          );
        })}
      </ol>

      {selected?.detail ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 px-5"
          onClick={() => setOpenId(null)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="animate-rise flex max-h-[min(88dvh,34rem)] w-full max-w-[380px] flex-col rounded-[24px] bg-white shadow-[0_12px_40px_rgba(14,13,99,0.22)]"
          >
            <div className="flex items-start justify-between gap-2 px-5 pt-5">
              <div className="min-w-0">
                <p id="stop-title" className="text-[1.15rem] font-bold leading-snug tracking-[-0.02em] text-ink">{selected.title}</p>
                {selected.sub ? <p className="mt-1 text-[13px] text-ink-soft">{selected.sub}</p> : null}
              </div>
              <button type="button" onClick={() => setOpenId(null)} className="-mr-1.5 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-sunken">
                <X size={18} weight="bold" /><span className="sr-only">Close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
              {selected.detail.note ? <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{selected.detail.note}</p> : null}
              {selected.detail.facts?.length ? (
                <dl className="mt-3 space-y-2.5">
                  {selected.detail.facts.map((fact) => (
                    <div key={fact.label}>
                      <dt className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">{fact.label}</dt>
                      <dd className="text-[13.5px] font-semibold text-ink">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {selected.detail.items?.length ? (
                <ul className="mt-3 space-y-2">
                  {selected.detail.items.map((item) => {
                    const done = itemDone(item);
                    return (
                      <li key={item.id ?? item.label}>
                        {item.id ? (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={done}
                            onClick={() => toggleItem(item.id!, done)}
                            className="press flex min-h-11 w-full items-center gap-3 rounded-[14px] border border-rule bg-surface px-3 py-2.5 text-left"
                          >
                            <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-[8px] border-2 ${done ? "border-iris bg-iris text-white" : "border-rule-strong text-transparent"}`}>
                              <Check size={14} weight="bold" />
                            </span>
                            <span className={`text-[13.5px] font-semibold ${done ? "text-ink-faint line-through" : "text-ink"}`}>{item.label}</span>
                          </button>
                        ) : (
                          <span className="flex items-start gap-2.5 text-[13.5px] leading-snug">
                            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-iris/50" />
                            <span className="text-ink">{item.label}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
            <div className="px-5 pb-5 pt-3">
              <button
                type="button"
                onClick={openTimelineList}
                className="cta inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white"
              >
                Full timeline
              </button>
              {selected.detail.moreHref ? (
                <Link
                  href={withMapReturn(selected.detail.moreHref)}
                  className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-full text-[13px] font-bold text-iris"
                >
                  {selected.detail.moreLabel ?? "Open"}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PathBend({ toRight, filled, bird }: { toRight: boolean; filled: boolean; bird?: boolean }) {
  const d = toRight
    ? "M 36 2 C 36 30, 164 16, 164 46"
    : "M 164 2 C 164 30, 36 16, 36 46";
  return (
    <svg viewBox="0 0 200 48" aria-hidden className="-my-0.5 h-11 w-full overflow-visible">
      <path
        d={d}
        fill="none"
        stroke={filled ? "#5e44fb" : "#b7b3e8"}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={filled ? undefined : "5 8"}
      />
      {bird ? (
        <g transform={toRight ? "translate(88 10)" : "translate(78 10)"}>
          <path
            d="M0 9c3.2-7 6.4-7 9.6 0 3.2-6.5 6.4-5.8 9.8.4"
            fill="none"
            stroke="#8e88c4"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      ) : null}
    </svg>
  );
}

function MapDoodle({ kind }: { kind: (typeof SIDE_DOODLES)[number] }) {
  if (kind === "birds") {
    return (
      <svg viewBox="0 0 36 22" className="h-6 w-10 animate-bird" aria-hidden>
        <path d="M1 16c5-11 10-11 15 0" fill="none" stroke="#8e88c4" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M18 10c4-9 8-8 13 1" fill="none" stroke="#b0aad8" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "tree") {
    return (
      <svg viewBox="0 0 30 40" className="h-10 w-8" aria-hidden>
        <circle cx="15" cy="13" r="10" fill="#c9c3ee" />
        <circle cx="9" cy="17" r="7" fill="#d8d3f6" />
        <circle cx="21" cy="17" r="7" fill="#d4cef4" />
        <rect x="13.5" y="22" width="3" height="15" rx="1.4" fill="#b7b0de" />
      </svg>
    );
  }
  if (kind === "bush") {
    return (
      <svg viewBox="0 0 34 22" className="h-7 w-10" aria-hidden>
        <circle cx="11" cy="13" r="8" fill="#d4cff2" />
        <circle cx="22" cy="12" r="9" fill="#c7c1ea" />
        <circle cx="17" cy="15" r="6.5" fill="#ddd8f6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 22 28" className="h-8 w-6" aria-hidden>
      <circle cx="11" cy="10" r="2.6" fill="#f6d9a8" />
      <circle cx="11" cy="4.4" r="2.3" fill="#d5cff3" />
      <circle cx="11" cy="15.6" r="2.3" fill="#d5cff3" />
      <circle cx="5.6" cy="10" r="2.3" fill="#d5cff3" />
      <circle cx="16.4" cy="10" r="2.3" fill="#d5cff3" />
      <rect x="10" y="17" width="2" height="9" rx="1" fill="#b7b0de" />
    </svg>
  );
}
