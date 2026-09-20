import { Card, ScreenHeader, SectionHeading } from "@/components/ui";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Access Gaps: what the public registry does not say, with denominators.
 * These are signals about published information. They are not evidence that any
 * site turns people away, and not evidence that people near a site would qualify.
 */
export default function AccessGapsPage() {
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as any).c as number;

  const total = count("SELECT COUNT(*) c FROM trials WHERE is_fictional = 0");
  const noLocations = count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id)");

  const gaps = [
    { label: "No published visit schedule", n: total, d: total },
    { label: "Record not updated in over a year", d: total,
      n: count("SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND last_update_post_date IS NOT NULL AND julianday('now') - julianday(last_update_post_date) > 365") },
    { label: "No contact listed at any site", d: total,
      n: count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.has_contact=1)") },
    { label: "No study locations listed", n: noLocations, d: total },
    { label: "No site-level recruiting status", d: total - noLocations,
      n: count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id) AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.site_status IS NOT NULL)") },
    { label: "No age bounds stated", d: total,
      n: count("SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND min_age_years IS NULL AND max_age_years IS NULL") },
  ];

  const states = db.prepare(
    `SELECT s.state, COUNT(DISTINCT s.trial_id) c FROM sites s JOIN trials t ON t.id = s.trial_id
     WHERE t.is_fictional=0 AND s.country='United States' AND s.state IS NOT NULL GROUP BY s.state ORDER BY c DESC`
  ).all() as { state: string; c: number }[];

  return (
    <div className="space-y-4">
      <ScreenHeader back="/profile" title="What the public data does not say" />

      <ul className="space-y-2.5">
        {gaps.map((gap) => {
          const share = gap.d > 0 ? (gap.n / gap.d) * 100 : 0;
          return (
            <Card as="li" key={gap.label} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13.5px] font-bold text-ink">{gap.label}</p>
                <p className="shrink-0 font-mono text-[12.5px] text-ink">{gap.n} / {gap.d} <span className="text-ink-faint">({share.toFixed(1)}%)</span></p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" role="img" aria-label={`${share.toFixed(1)} percent of records`}>
                <div className="h-full rounded-full bg-iris" style={{ width: `${Math.max(2, Math.min(100, share))}%` }} />
              </div>
            </Card>
          );
        })}
      </ul>

      <section>
        <SectionHeading>Where the listed sites are</SectionHeading>
        <Card className="p-4">
          <ul className="space-y-2">
            {states.slice(0, 10).map((entry) => (
              <li key={entry.state} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2.5 text-[12.5px]">
                <span className="truncate text-ink-soft">{entry.state}</span>
                <span className="h-2 rounded-full bg-iris" style={{ width: `${(entry.c / states[0].c) * 100}%` }} />
                <span className="text-right font-mono text-ink">{entry.c}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
