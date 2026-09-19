import Link from "next/link";
import { CaretRight, ChatCircleDots, Heart, MagnifyingGlass, MapPin, Question } from "@phosphor-icons/react/dist/ssr";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { Card, Empty, Note, Pill, ScreenHeader } from "@/components/ui";
import { assessTrial } from "@/lib/assess";
import { requestNow, monthsSince, STALE_RECORD_MONTHS } from "@/lib/clock";
import { getManifest } from "@/lib/db";
import { getTrial } from "@/lib/repo";
import { searchForProfile } from "@/lib/search";
import { getActiveParticipant } from "@/lib/session";
import type { ParticipantProfile, Trial, TrialAssessment } from "@/lib/types";

export const dynamic = "force-dynamic";

const KM_PER_MILE = 1.609;

/** The label on a card. None of these is a verdict, and none says "you qualify". */
function cardStatus(assessment: TrialAssessment) {
  if (assessment.overall === "likely_conflict") {
    return { label: "Things to review", tone: "iris" as const, icon: <ChatCircleDots size={13} weight="fill" /> };
  }
  if (assessment.overall === "needs_more_information") {
    return { label: "Questions remain", tone: "peach" as const, icon: <Question size={13} weight="fill" /> };
  }
  return { label: "Potential option", tone: "blush" as const, icon: <Heart size={13} weight="fill" /> };
}

export default async function ExplorePage({
  searchParams,
}: { searchParams: Promise<{ q?: string; phase?: string; near?: string; sort?: string }> }) {
  const params = await searchParams;
  const participant = await getActiveParticipant();
  const now = requestNow();
  const manifest = getManifest() as { retrievedAt?: string; recordCount?: number } | null;

  const result = searchForProfile(participant, { text: params.q || null, limit: 40 });

  let rows = result.hits.map((hit) => ({ hit, assessment: assessTrial(hit.trial, participant) }));

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
  const demoStudy = !params.q && !params.phase ? getTrial("TP-FIX-001") : null;

  const keep = (extra: Record<string, string>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ q: params.q, phase: params.phase, near: params.near, sort: params.sort, ...extra })) {
      if (value) next.set(key, value);
    }
    const query = next.toString();
    return query ? `/explore?${query}` : "/explore";
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Find Clinical Trials" sub="Search for trials that may be right to discuss with your care team." />

      <form action="/explore" className="space-y-3">
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
          <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-iris px-3.5 text-[13px] font-semibold text-white">
            {participant.condition ?? "Any condition"}
          </span>
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

      {demoStudy ? (
        <section aria-labelledby="demo-heading" className="space-y-2">
          <h2 id="demo-heading" className="text-[12px] font-bold text-ink-soft">
            Demo study, kept apart because it isn&rsquo;t a real option
          </h2>
          <ul><TrialCard trial={demoStudy} assessment={assessTrial(demoStudy, participant)} participant={participant} reasons={[]} now={now} /></ul>
          <h2 className="pt-1.5 text-[12px] font-bold text-ink-soft">From the public registry</h2>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <Empty title="No trials matched" icon={<MagnifyingGlass size={22} />}>
          Try fewer words or a wider location. A study missing here has not been ruled out. It
          may simply not be in this snapshot.
        </Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ hit, assessment }) => (
            <TrialCard key={hit.trial.id} trial={hit.trial} assessment={assessment} participant={participant} reasons={hit.reasons} now={now} />
          ))}
        </ul>
      )}

      <Note>
        A fixed snapshot of {manifest?.recordCount ?? "public"} ClinicalTrials.gov records
        {manifest?.retrievedAt ? `, taken ${manifest.retrievedAt.slice(0, 10)}` : ""}. Keyword search
        ({result.backend === "sqlite_fts5" ? "SQLite FTS5" : "Elasticsearch"}, {result.tookMs}ms).
        A study listed as recruiting may not have a place open near you.
      </Note>
    </div>
  );
}

function TrialCard({
  trial, assessment, participant, reasons, now,
}: { trial: Trial; assessment: TrialAssessment; participant: ParticipantProfile; reasons: string[]; now: number }) {
  const overall = trial.overallStatus ? trial.overallStatus.toLowerCase().replace(/_/g, " ") : "status not stated";
  const siteKnown = assessment.practicalFit.siteRecruitingStatusKnown;
  const stale = trial.lastUpdatePostDate ? monthsSince(trial.lastUpdatePostDate, now) > STALE_RECORD_MONTHS : false;
  // The card already shows condition and location, so repeat neither as a reason.
  const why = reasons.filter((reason) => !/^Listed condition|^Has a listed site/.test(reason)).slice(0, 2);
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
            <Pill tone={status.tone} icon={status.icon}>{status.label}</Pill>
            {trial.isFictional ? <Pill tone="peach">Fictional</Pill> : null}
          </div>
          <h3 className="mt-2 line-clamp-2 text-[14.5px] font-bold leading-snug text-ink">{trial.briefTitle ?? trial.id}</h3>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[12.5px] text-ink-soft">
            <span>{trial.phases.length ? trial.phases.join(", ").replace(/PHASE/g, "Phase ").replace(/\bNA\b/, "No phase (not a drug study)") : "Phase not stated"}</span>
            {condition ? <><span aria-hidden className="text-rule-strong">|</span><span className="truncate">{condition}</span></> : null}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-soft">
            <MapPin size={14} className="shrink-0 text-iris" />
            {site?.city
              ? `${site.city}${site.state ? `, ${site.state}` : ""}${miles != null ? ` (about ${miles} miles)` : ""}`
              : trial.sites.length ? "Distance not known" : "No locations listed"}
          </p>
          {/* Study-level and site-level status are different facts, so both are stated. */}
          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-soft">
            <span className="font-semibold capitalize text-ink">{overall}</span>
            {trial.sites.length ? (siteKnown ? ", site status published" : ", site status not published") : ""}
            <span className={stale ? "font-semibold text-peach" : ""}>
              {trial.lastUpdatePostDate ? `, record updated ${trial.lastUpdatePostDate}${stale ? " (over a year ago)" : ""}` : ", record date not stated"}
            </span>
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {assessment.conflicts} to review, {assessment.unknowns} unanswered, {assessment.supported} matched
            {participant.maxTravelMinutes && assessment.practicalFit.withinStatedTravelPreference === false ? ", farther than you prefer" : ""}
          </p>
          {why.length ? (
            <ul className="mt-1 space-y-0.5">
              {why.map((reason) => <li key={reason} className="text-[11.5px] leading-snug text-ink-faint">{reason}</li>)}
            </ul>
          ) : null}
        </div>
        <CaretRight size={18} weight="bold" className="shrink-0 text-iris" />
      </Link>
    </Card>
  );
}
