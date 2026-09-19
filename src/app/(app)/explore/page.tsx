import Link from "next/link";
import { Card, DataAge, Empty, Note } from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import { searchForProfile } from "@/lib/search";
import { getActiveParticipant } from "@/lib/session";
import { getManifest } from "@/lib/db";
import { requestNow } from "@/lib/clock";
import { getTrial } from "@/lib/repo";
import type { SearchHit } from "@/lib/search";
import type { ParticipantProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExplorePage({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const participant = await getActiveParticipant();
  // Read the clock once so every date on this page is judged against one instant.
  const now = requestNow();
  const manifest = getManifest() as { retrievedAt?: string; recordCount?: number } | null;

  const result = searchForProfile(participant, params.q ? { text: params.q } : {});

  // The demonstration study is shown under its own heading rather than mixed
  // into the ranking. It is invented, so it has no honest relevance score, and
  // ranking it beside real records would imply one.
  const demoStudy = getTrial("TP-FIX-001");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Explore options</h1>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Studies from the public registry that look worth a conversation, based on the
          condition and location in your passport. Nothing here means you qualify — only
          study staff can decide that.
        </p>
      </div>

      <form action="/explore" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Add words to narrow this, e.g. surgery, radiation"
          aria-label="Refine your search"
          className="min-h-11 flex-1 rounded-lg border border-rule bg-paper-raised px-3.5 text-sm text-ink placeholder:text-ink-faint"
        />
        <button
          type="submit"
          className="min-h-11 rounded-lg border border-teal bg-teal px-4 text-sm font-medium text-white hover:bg-teal-deep"
        >
          Search
        </button>
      </form>

      <p className="text-xs leading-relaxed text-ink-faint">
        {result.hits.length} of {result.totalCandidates} candidates shown · searched in{" "}
        {result.tookMs}ms · {result.backend === "sqlite_fts5" ? "SQLite FTS5" : "Elasticsearch"}
        {result.lexicalOnly ? " (keyword matching only — no semantic ranking configured)" : ""}
        {manifest?.retrievedAt
          ? ` · snapshot of ${manifest.recordCount} records taken ${manifest.retrievedAt.slice(0, 10)}`
          : ""}
      </p>

      {demoStudy ? (
        <section aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="mb-1.5 text-sm font-semibold text-ink">
            Demonstration study
          </h2>
          <p className="mb-2 text-sm leading-relaxed text-ink-soft">
            Real registry records do not publish visit schedules, so none of the studies below
            can show you what taking part would cost in time. This invented study can. It is
            shown separately because it is not a real option and has no place in a ranking of
            real ones.
          </p>
          <ul>
            <TrialCard
              hit={{ trial: demoStudy, score: 0, reasons: [], matchedCriterionIds: [] }}
              participant={participant}
              now={now}
            />
          </ul>
        </section>
      ) : null}

      <h2 className="text-sm font-semibold text-ink">From the public registry</h2>

      {result.hits.length === 0 ? (
        <Empty title="No options matched">
          Try removing words from your search, or widen the condition in your passport. A
          study that does not appear here has not been ruled out — it may simply not be in
          this snapshot.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {result.hits.map((hit) => (
            <TrialCard key={hit.trial.id} hit={hit} participant={participant} now={now} />
          ))}
        </ul>
      )}

      <Note>
        This search covers a fixed snapshot of public ClinicalTrials.gov records for one
        condition area. It is not a complete list of trials, and a study being listed as
        recruiting does not mean a place is open at a site near you.
      </Note>
    </div>
  );
}

function TrialCard({
  hit, participant, now,
}: { hit: SearchHit; participant: ParticipantProfile; now: number }) {
  const { trial } = hit;
  const assessment = assessTrial(trial, participant);
  const fit = assessment.practicalFit;

  return (
    <Card as="li" className="overflow-hidden transition-colors hover:border-rule-strong">
      <Link href={`/trial/${trial.id}`} className="block p-4">
        {trial.isFictional ? (
          <p className="mb-2 inline-flex rounded border border-amber/40 bg-amber-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber">
            Fictional demonstration study
          </p>
        ) : null}

        <h2 className="text-base font-semibold leading-snug text-ink">
          {trial.briefTitle ?? trial.id}
        </h2>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          <span className="font-mono">{trial.id}</span>
          {trial.phases.length ? <span>{trial.phases.join(", ").replace(/PHASE/g, "Phase ")}</span> : null}
          <span>{trial.overallStatus?.toLowerCase().replace(/_/g, " ") ?? "status not stated"}</span>
        </div>

        {/* Clinical and practical read separately, and neither is a verdict. */}
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg border border-rule bg-paper-sunken p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Against what you recorded
            </p>
            <p className="text-sm font-medium text-ink">
              {assessment.overall === "likely_conflict"
                ? "Something may not match"
                : assessment.overall === "needs_more_information"
                  ? "Needs more information"
                  : "Potential option to discuss"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {assessment.conflicts} possible conflict{assessment.conflicts === 1 ? "" : "s"} ·{" "}
              {assessment.unknowns} unanswered · {assessment.supported} matched
            </p>
          </div>

          <div className="rounded-lg border border-rule bg-paper-sunken p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Practical
            </p>
            <p className="text-sm font-medium text-ink">
              {fit.nearestSiteKm != null
                ? `Nearest listed site about ${fit.nearestSiteKm} km away`
                : "Distance not known"}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
              {fit.siteRecruitingStatusKnown
                ? "Site recruiting status published"
                : "Site recruiting status not published"}
              {" · "}
              {fit.siteContactAvailable ? "Site contact listed" : "No site contact listed"}
            </p>
          </div>
        </div>

        {hit.reasons.length ? (
          <ul className="mt-2.5 space-y-1">
            {hit.reasons.map((reason) => (
              <li key={reason} className="flex gap-1.5 text-xs leading-relaxed text-ink-soft">
                <span aria-hidden className="text-ink-faint">·</span>
                {reason}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-2.5">
          <DataAge date={trial.lastUpdatePostDate} now={now} />
          <span className="text-sm font-medium text-teal">Read the brief →</span>
        </div>
      </Link>
    </Card>
  );
}
