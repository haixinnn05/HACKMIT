import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { withMapReturn } from "@/lib/map-return";

export type JourneyStop = {
  id: string;
  title: string;
  sub?: string;
  href: string;
  done: boolean;
};

const SIDE_DOODLES = ["tree", "birds", "bush", "flower", "tree"] as const;

/**
 * A top-to-bottom board-game path. Stops alternate left and right, joined by a
 * dotted trail, so the next thing to do reads as a place on a map.
 */
export function JourneyMap({ stops, startAt = 1 }: { stops: JourneyStop[]; startAt?: number }) {
  const currentIndex = stops.findIndex((stop) => !stop.done);

  return (
    <ol className="relative">
      {stops.map((stop, index) => {
        const left = index % 2 === 0;
        const current = index === currentIndex;
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
              <Link
                href={withMapReturn(stop.href)}
                aria-current={current ? "step" : undefined}
                suppressHydrationWarning
                className={`press relative block rounded-[20px] border bg-surface px-4 pb-4 pt-3.5 shadow-[0_2px_10px_rgba(14,13,99,0.04)] ${
                  current
                    ? "border-iris ring-4 ring-iris/15"
                    : stop.done
                      ? "border-rule"
                      : "border-dashed border-rule-strong"
                }`}
              >
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
              </Link>
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
