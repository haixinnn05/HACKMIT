import Link from "next/link";
import { Card, Note, SectionHeading } from "@/components/ui";
import { getDb, getManifest } from "@/lib/db";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Access Gaps.
 *
 * What the public registry does *not* say, measured with denominators. These are
 * signals about information availability, not evidence that any site
 * discriminates, and not evidence that people living near a listed site would
 * qualify. The page states that where a reader will see it rather than in a
 * footnote.
 */
export default function AccessGapsPage() {
  const db = getDb();
  const manifest = getManifest() as any;

  const total = (db.prepare("SELECT COUNT(*) c FROM trials WHERE is_fictional = 0").get() as any).c;

  const row = (sql: string) => (db.prepare(sql).get() as any).c as number;

  const noLocations = row(
    "SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id)"
  );
  const noContact = row(
    "SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.has_contact=1)"
  );
  const noSiteStatus = row(
    `SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0
     AND EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id)
     AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.trial_id=t.id AND s.site_status IS NOT NULL)`
  );
  const noAgeBound = row(
    "SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND min_age_years IS NULL AND max_age_years IS NULL"
  );
  const noCriteria = row(
    "SELECT COUNT(*) c FROM trials t WHERE t.is_fictional=0 AND NOT EXISTS (SELECT 1 FROM criteria c WHERE c.trial_id=t.id)"
  );
  const stale = row(
    `SELECT COUNT(*) c FROM trials WHERE is_fictional=0 AND last_update_post_date IS NOT NULL
     AND julianday('now') - julianday(last_update_post_date) > 365`
  );

  const states = db
    .prepare(
      `SELECT s.state, COUNT(DISTINCT s.trial_id) c FROM sites s
       JOIN trials t ON t.id = s.trial_id
       WHERE t.is_fictional=0 AND s.country='United States' AND s.state IS NOT NULL
       GROUP BY s.state ORDER BY c DESC`
    )
    .all() as { state: string; c: number }[];

  const totalStateCoverage = states.reduce((sum, entry) => sum + entry.c, 0);
  const top5Share = states.slice(0, 5).reduce((sum, entry) => sum + entry.c, 0) / (totalStateCoverage || 1);

  const gaps = [
    {
      label: "No study locations listed at all",
      count: noLocations,
      meaning: "There is no published place to go and no way to judge whether it is reachable.",
    },
    {
      label: "No contact listed at any site",
      count: noContact,
      meaning: "A person who wants to ask a question has nobody published to ask.",
    },
    {
      label: "No site-level recruiting status",
      count: noSiteStatus,
      meaning: "The study says it is recruiting, but not whether any particular location is.",
      denominator: total - noLocations,
    },
    {
      label: "No published visit schedule",
      count: total,
      meaning: "Nobody can work out the time commitment before contacting the site. This is the single largest gap.",
    },
    {
      label: "Record not updated in over a year",
      count: stale,
      meaning: "Recruiting status may have changed without the record being revised.",
    },
    {
      label: "No age bounds stated",
      count: noAgeBound,
      meaning: "Age eligibility has to be read from prose, or asked about.",
    },
    {
      label: "No eligibility criteria parsed",
      count: noCriteria,
      meaning: "Nothing can be compared against a person's own situation.",
    },
  ];

  return (
    <div className="space-y-5">
      <Link href="/passport" className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">← My passport</Link>

      <div className="page-intro">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-teal">Transparency by design</p>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink">
          What the public data does not say
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Every gap below is measured against the {total} public ClinicalTrials.gov records in
          this snapshot. They describe how much a person can learn before contacting a site.
        </p>
      </div>

      <Note tone="caution">
        These are gaps in published information, not evidence that a site turns anyone away.
        A study listing a site near you does not mean you would qualify for it, and a study
        with missing details is not necessarily worse run — its record is simply less complete.
      </Note>

      <section>
        <SectionHeading hint="Count, and share of the records it applies to.">
          Information gaps
        </SectionHeading>
        <ul className="space-y-2">
          {gaps.map((gap) => {
            const denominator = gap.denominator ?? total;
            const share = denominator > 0 ? (gap.count / denominator) * 100 : 0;
            return (
              <Card as="li" key={gap.label} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-ink">{gap.label}</p>
                  <p className="font-mono text-sm text-ink">
                    {gap.count} / {denominator}{" "}
                    <span className="text-ink-faint">({share.toFixed(1)}%)</span>
                  </p>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-sunken"
                  role="img"
                  aria-label={`${share.toFixed(1)} percent of records`}
                >
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{gap.meaning}</p>
              </Card>
            );
          })}
        </ul>
      </section>

      <section>
        <SectionHeading hint={`Studies with at least one listed site in each US state. ${(top5Share * 100).toFixed(0)}% of state-level coverage is concentrated in the top five.`}>
          Where the listed sites are
        </SectionHeading>
        <Card className="p-4">
          <ul className="space-y-1.5">
            {states.slice(0, 12).map((entry) => (
              <li key={entry.state} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate text-ink-soft">{entry.state}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-sunken">
                  <span
                    className="block h-full rounded-full bg-slate"
                    style={{ width: `${(entry.c / states[0].c) * 100}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-ink">{entry.c}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            {states.length} US states and territories appear across this snapshot. A state with
            few listed studies may reflect where sponsors chose to open sites, where research
            infrastructure exists, or simply how completely records were filled in — this
            measurement cannot distinguish between those.
          </p>
        </Card>
      </section>

      <Card className="p-4">
        <h2 className="mb-1.5 text-sm font-semibold text-ink">About this snapshot</h2>
        <dl className="space-y-1 text-xs text-ink-soft">
          <div><dt className="inline font-medium">Source: </dt><dd className="inline">{manifest?.source ?? "ClinicalTrials.gov API v2"}</dd></div>
          <div><dt className="inline font-medium">Condition queried: </dt><dd className="inline">{manifest?.condition ?? "breast cancer"}</dd></div>
          <div><dt className="inline font-medium">Retrieved: </dt><dd className="inline">{manifest?.retrievedAt ?? "unknown"}</dd></div>
          <div><dt className="inline font-medium">Records: </dt><dd className="inline">{manifest?.recordCount ?? total} of {manifest?.totalAvailableAtQueryTime ?? "unknown"} matching at query time</dd></div>
          <div><dt className="inline font-medium">Content hash: </dt><dd className="inline font-mono break-all">{manifest?.contentHash ?? "—"}</dd></div>
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          This is a partial snapshot of one condition area, not a census of clinical research.
          Percentages describe these records only and should not be generalised to all trials.
        </p>
      </Card>
    </div>
  );
}
