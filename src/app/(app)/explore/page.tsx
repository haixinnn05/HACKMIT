import Link from "next/link";
import { CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Card, Empty, Pill, ScreenHeader } from "@/components/ui";
import { openedFromMap } from "@/lib/map-return";
import { assessTrial, criteriaMatchCopy } from "@/lib/assess";
import { getTrial, listConfirmedCriterionIdsByTrial } from "@/lib/repo";
import { searchForProfileAsync } from "@/lib/search";
import { getActiveParticipant } from "@/lib/session";
import type { Trial, TrialAssessment } from "@/lib/types";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

/** The label on a card. None of these is a verdict, and none says "you qualify". */
function cardStatus(assessment: TrialAssessment) {
  return criteriaMatchCopy(assessment);
}

export default async function ExplorePage({
  searchParams,
}: { searchParams: Promise<{ q?: string; phase?: string; near?: string; sort?: string; cond?: string; from?: string }> }) {
  const params = await searchParams;
  const participant = await getActiveParticipant();
  const confirmedByTrial = listConfirmedCriterionIdsByTrial(participant.id);

  // The condition chip is a real filter. Turning it off searches every record
  // in the snapshot rather than only the person's own condition.
  const anyCondition = params.cond === "any";
  const result = await searchForProfileAsync(participant, {
    text: params.q || null, limit: 40, ...(anyCondition ? { condition: null } : {}),
  });

  let rows = result.hits.map((hit) => ({
    hit,
    assessment: assessTrial(hit.trial, participant, confirmedByTrial.get(hit.trial.id) ?? []),
  }));

  if (params.phase) rows = rows.filter(({ hit }) => hit.trial.phases.includes(params.phase!));

  // Distance filters keep records whose distance is unknown. Dropping them would
  // hide an option the person could otherwise ask about.
  const maxMiles = params.near === "50" ? 50 : params.near === "150" ? 150 : null;
  if (maxMiles) {
    rows = rows.filter(({ assessment }) => {
      const km = assessment.practicalFit.nearestSiteKm;
      return km == null || km / KM_PER_MILE <= maxMiles;
    });
  }
  if (params.near === "state" && participant.state) {
    rows = rows.filter(({ hit }) =>
      hit.trial.sites.length === 0 || hit.trial.sites.some((site) => site.state === participant.state));
  }
  if (params.sort === "recent") {
    rows = [...rows].sort((a, b) => (b.hit.trial.lastUpdatePostDate ?? "").localeCompare(a.hit.trial.lastUpdatePostDate ?? ""));
  }

  const total = rows.length;
  rows = rows.slice(0, 12);
  const demoStudy = !params.q && !params.phase && !anyCondition ? getTrial("TP-FIX-001") : null;

  // Studies a research team posted on Mozaic. They go through the same search
  // and the same filters as registry records, so a posted study is found by the
  // words and condition a person actually uses, and a paused one drops out.
  // When the person typed something, only their words are matched: their condition
  // is a ranking hint for the registry list, and on its own it would make every
  // posted study for that condition answer every search.
  const posted = (await searchForProfileAsync(participant, {
    text: params.q || null, limit: 200, includeFictional: true, ...(anyCondition || params.q ? { condition: null } : {}),
  })).hits
    .filter((hit) => hit.trial.isFictional && hit.trial.id !== "TP-FIX-001")
    .filter((hit) => !params.phase || hit.trial.phases.includes(params.phase))
    .slice(0, 4);

  const keep = (extra: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: params.q, phase: params.phase, near: params.near, sort: params.sort, cond: params.cond, from: params.from, ...extra })) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/explore?${query}` : "/explore";
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Find Clinical Trials" back={openedFromMap(params.from) ? "/" : undefined} />

      <form action="/explore" className="space-y-3">
        {openedFromMap(params.from) ? <input type="hidden" name="from" value="map" /> : null}
        <label className="relative block">
          <span className="sr-only">Search by condition, keyword or location</span>
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search" name="q" defaultValue={params.q ?? ""}
            placeholder="Search by condition, keyword, or location"
            className="min-h-12 w-full rounded-full border border-rule bg-surface pl-11 pr-4 text-[13.5px] text-ink placeholder:text-ink-faint"
          />
        </label>

        <div className="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-0.5">
          <Link
            href={keep({ cond: anyCondition ? "" : "any" })}
            aria-pressed={!anyCondition}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${
              anyCondition ? "border border-rule bg-surface text-ink" : "bg-iris text-white"
            }`}
          >
            {anyCondition ? "Any condition" : <>{participant.condition ?? "My condition"} <X size={12} weight="bold" /></>}
            <span className="sr-only">{anyCondition ? ", tap to search only my condition" : ", tap to search every condition"}</span>
          </Link>
          {anyCondition ? <input type="hidden" name="cond" value="any" /> : null}
          <AutoSubmitSelect name="near" label="Location" defaultValue={params.near ?? ""} options={[
            { value: "", label: "Location" }, { value: "50", label: "Within 50 mi" },
            { value: "150", label: "Within 150 mi" }, { value: "state", label: "My state" },
          ]} />
          <AutoSubmitSelect name="phase" label="Phase" defaultValue={params.phase ?? ""} options={[
            { value: "", label: "Phase" }, { value: "PHASE1", label: "Phase 1" }, { value: "PHASE2", label: "Phase 2" },
            { value: "PHASE3", label: "Phase 3" }, { value: "PHASE4", label: "Phase 4" },
          ]} />
          {params.sort ? <input type="hidden" name="sort" value={params.sort} /> : null}
        </div>
      </form>

      <div className="-my-1.5 flex items-center justify-between text-[12.5px] text-ink-soft">
        <span>{total} {total === 1 ? "trial" : "trials"} found</span>
        <Link href={keep({ sort: params.sort === "recent" ? "" : "recent" })} className="flex min-h-11 items-center font-semibold text-ink">
          Sort: {params.sort === "recent" ? "Recently updated" : "Relevance"}
        </Link>
      </div>

      {demoStudy || posted.length ? (
        <section aria-labelledby="posted-on-mozaic">
          <h2 id="posted-on-mozaic" className="mb-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-ink-faint">Posted by research teams on Mozaic</h2>
          <ul className="space-y-3">
            {demoStudy ? <TrialCard trial={demoStudy} assessment={assessTrial(demoStudy, participant, confirmedByTrial.get(demoStudy.id) ?? [])} /> : null}
            {posted.map((hit) => <TrialCard key={hit.trial.id} trial={hit.trial} assessment={assessTrial(hit.trial, participant, confirmedByTrial.get(hit.trial.id) ?? [])} />)}
          </ul>
          <h2 className="mb-2 mt-5 text-[12.5px] font-bold uppercase tracking-[0.06em] text-ink-faint">From ClinicalTrials.gov</h2>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <Empty title="No trials matched">Try fewer words or a wider location.</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ hit, assessment }) => (
            <TrialCard key={hit.trial.id} trial={hit.trial} assessment={assessment} />
          ))}
        </ul>
      )}

      {/* Which search engine answered, and how fast. If Elasticsearch is down this says SQLite, because that is what ran. */}
      <p className="pt-1 text-center text-[11px] text-ink-faint">
        Ranked {result.totalCandidates} matching records with {result.backend === "elasticsearch" ? "Elasticsearch" : "SQLite full-text search"} in {result.tookMs} ms
      </p>
    </div>
  );
}

function TrialCard({
  trial, assessment,
}: { trial: Trial; assessment: TrialAssessment }) {
  const overall = trial.overallStatus ? trial.overallStatus.toLowerCase().replace(/_/g, " ") : "status not stated";
  const status = cardStatus(assessment);
  const site = assessment.practicalFit.nearestSite;
  const km = assessment.practicalFit.nearestSiteKm;
  const miles = km != null ? Math.round(km / KM_PER_MILE) : null;
  const condition = trial.conditions.find((c) => /breast|cancer|carcinoma/i.test(c)) ?? trial.conditions[0];

  return (
    <Card as="li">
      <Link href={`/trial/${trial.id}`} className="press flex items-center gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone={status.tone}>{status.title}</Pill>
          </div>
          <h3 className="mt-2 line-clamp-2 text-[14.5px] font-bold leading-snug text-ink">{trial.briefTitle ?? trial.id}</h3>
          <p className="mt-1 text-[12px] leading-snug text-ink-soft">{status.body}</p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[12.5px] text-ink-soft">
            <span>{trial.phases.length ? trial.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Phase not stated"}</span>
            {condition ? <><span aria-hidden className="text-rule-strong">|</span><span className="truncate">{condition}</span></> : null}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            {site?.city
              ? `${site.city}${site.state ? `, ${site.state}` : ""}${miles != null ? ` (about ${miles} miles)` : ""}`
              : trial.sites.length ? "Distance not known" : "No locations listed"}
          </p>
          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
            <span className="font-semibold capitalize text-ink">{overall}</span>
            {trial.lastUpdatePostDate ? ` · ${trial.lastUpdatePostDate}` : ""}
          </p>
        </div>
        <CaretRight size={18} weight="bold" className="shrink-0 text-iris" />
      </Link>
    </Card>
  );
}
