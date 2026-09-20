import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Pill, SectionHeading } from "@/components/ui";
import { getOpenAlexResearch, OPENALEX_DATASET_URL, type OpenAlexWork } from "@/lib/openalex";
import type { Trial } from "@/lib/types";

/**
 * Insight: scholarly background from the OpenAlex open dataset.
 *
 * Kept visibly apart from the study's own requirements. A paper can explain the
 * medical context; it cannot establish anyone's eligibility or a site's local
 * procedure. The query is built from public trial fields only, so no passport
 * data ever reaches OpenAlex.
 */

function authorLine(work: OpenAlexWork): string {
  if (work.authors.length === 0) return "Authors not listed";
  return `${work.authors.join(", ")}${work.authors.length === 3 ? ", et al." : ""}`;
}

export function OpenAlexResearchSkeleton() {
  return (
    <section aria-label="Background research loading">
      <SectionHeading>Insight</SectionHeading>
      <Card className="space-y-3 p-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="space-y-1.5">
            <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-sunken" />
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-sunken" />
          </div>
        ))}
      </Card>
    </section>
  );
}

export async function OpenAlexResearch({ trial }: { trial: Trial }) {
  let result;
  try {
    result = await getOpenAlexResearch(trial);
  } catch (error) {
    console.warn("[openalex] background research unavailable:", error);
    return (
      <section aria-labelledby="openalex-heading">
        <SectionHeading id="openalex-heading">Insight</SectionHeading>
        <Card className="p-4 text-[13px]">
          <a href={OPENALEX_DATASET_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-iris hover:underline">
            OpenAlex open dataset <ArrowSquareOut size={14} />
          </a>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="openalex-heading">
      <SectionHeading id="openalex-heading">Insight</SectionHeading>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <span className="text-[12px] font-bold text-ink-soft">OpenAlex</span>
          <span className="text-[11px] text-ink-faint">{result.fetchedAt.slice(0, 10)}</span>
        </div>

        {result.works.length > 0 ? (
          <ul>
            {result.works.map((work) => (
              <li key={work.id} className="border-b border-rule last:border-0">
                <a href={work.id} target="_blank" rel="noreferrer" className="press block px-4 py-3.5 hover:bg-sunken">
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-[13.5px] font-bold leading-snug text-ink">{work.title}</span>
                    <ArrowSquareOut size={15} className="mt-0.5 shrink-0 text-iris" />
                  </span>
                  <span className="mt-1 block text-[12px] text-ink-soft">{authorLine(work)}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
                    {[work.venue, work.publicationYear, `${work.citedByCount.toLocaleString()} citations`]
                      .filter(Boolean).join(", ")}
                    {work.isOpenAccess ? <Pill tone="mint">Open access</Pill> : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-[13px] leading-relaxed text-ink-soft">
            OpenAlex does not currently index a close match for this study topic.
          </p>
        )}
      </Card>
    </section>
  );
}
