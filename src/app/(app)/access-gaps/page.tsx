import { Callout, Card, ScreenHeader, SectionHeading } from "@/components/ui";
import { getDb, getManifest } from "@/lib/db";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Access Gaps: what the public registry does not say, with denominators.
 * These are signals about published information. They are not evidence that any
 * site turns people away, and not evidence that people near a site would qualify.
 */
export default function AccessGapsPage() {
  const db = getDb();
  const manifest = getManifest() as any;
  const count = (sql: string) => (db.prepare(sql).get() as any).c as number;

  const total = count("SELECT COUNT(*) c FROM trials WHERE is_fictional = 0");
  const noLocations = count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id)");

  const gaps = [
    { label: "No published visit schedule", n: total, d: total, meaning: "Nobody can work out the time commitment before contacting the site. This is the largest gap." },
    { label: "Record not updated in over a year", d: total, meaning: "Recruiting status may have changed without the record being revised.",
      n: count("SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND last_update_post_date IS NOT NULL AND julianday('now') - julianday(last_update_post_date) > 365") },
    { label: "No contact listed at any site", d: total, meaning: "A person with a question has nobody published to ask.",
      n: count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.has_contact=1)") },
    { label: "No study locations listed", n: noLocations, d: total, meaning: "There is no published place to go, so reachability cannot be judged." },
    { label: "No site-level recruiting status", d: total - noLocations, meaning: "The study says it is recruiting, but not whether a given location is.",
      n: count("SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id) AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.site_status IS NOT NULL)") },
    { label: "No age bounds stated", d: total, meaning: "Age eligibility has to be read from prose, or asked about.",
      n: count("SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND min_age_years IS NULL AND max_age_years IS NULL") },
  ];

  const states = db.prepare(
    `SELECT s.state, COUNT(DISTINCT s.trial_id) c FROM sites s JOIN trials t ON t.id = s.trial_id
     WHERE t.is_fictional=0 AND s.country='United States' AND s.state IS NOT NULL GROUP BY s.state ORDER BY c DESC`
  ).all() as { state: string; c: number }[];
  const coverage = states.reduce((sum, entry) => sum + entry.c, 0) || 1;
  const top5 = Math.round((states.slice(0, 5).reduce((sum, entry) => sum + entry.c, 0) / coverage) * 100);

  return (
    <div className="space-y-4">
      <ScreenHeader back="/profile" title="What the public data does not say" sub={`Measured across the ${total} public ClinicalTrials.gov records in this snapshot.`} />

      <Callout tone="caution">
        These are gaps in published information, not evidence that a site turns anyone away. A
        study with missing details is not necessarily worse run. Its record is simply less complete.
      </Callout>

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
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{gap.meaning}</p>
            </Card>
          );
        })}
      </ul>

      <section>
        <SectionHeading hint={`Studies with at least one listed site per US state. ${top5}% of state-level coverage sits in the top five.`}>Where the listed sites are</SectionHeading>
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
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">
            A state with few listed studies may reflect where sponsors opened sites, where research
            infrastructure exists, or how completely records were filled in. This measurement cannot
            tell those apart.
          </p>
        </Card>
      </section>

      <Card className="p-4 text-[12px] leading-relaxed text-ink-soft">
        <p className="mb-1 text-[13.5px] font-bold text-ink">About this snapshot</p>
        <p>Source: {manifest?.source ?? "ClinicalTrials.gov API v2"}. Condition queried: {manifest?.condition ?? "breast cancer"}.</p>
        <p>Retrieved {manifest?.retrievedAt ?? "unknown"}. {manifest?.recordCount ?? total} of {manifest?.totalAvailableAtQueryTime ?? "unknown"} matching records.</p>
        <p className="break-all font-mono text-[10.5px] text-ink-faint">{manifest?.contentHash ?? ""}</p>
        <p className="mt-1.5 text-ink-faint">A partial snapshot of one condition area, not a census. Percentages describe these records only.</p>
      </Card>
    </div>
  );
}
