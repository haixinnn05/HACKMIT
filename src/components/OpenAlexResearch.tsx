import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, Pill, SectionHeading } from "@/components/ui";
import { getOpenAlexResearch, OPENALEX_DATASET_URL, type OpenAlexWork } from "@/lib/openalex";
import type { Trial } from "@/lib/types";

/**
 * Insight: the medical background behind a study, from the OpenAlex open index
 * of scholarly work. Quoted as published. Public trial fields only, so no
 * passport data reaches OpenAlex.
 */

function byline(work: OpenAlexWork): string {
  const authors = work.authors.length ? `${work.authors.join(", ")}${work.authors.length === 3 ? ", et al." : ""}` : "Authors not listed";
  return [authors.replace(/\.$/, ""), work.venue, work.publicationYear].filter(Boolean).join(". ");
}

export function OpenAlexResearchSkeleton() {
  return (
    <section aria-label="Background research loading" className="space-y-3">
      <Card className="space-y-2.5 p-4">
        <div className="h-3.5 w-1/2 animate-pulse rounded-full bg-sunken" />
        {[0, 1, 2].map((row) => <div key={row} className="h-3 animate-pulse rounded-full bg-sunken" style={{ width: `${96 - row * 14}%` }} />)}
      </Card>
      {[0, 1].map((row) => (
        <Card key={row} className="space-y-2 p-4">
          <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-sunken" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-sunken" />
        </Card>
      ))}
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
      <Card className="p-4 text-[13px]">
        <a href={OPENALEX_DATASET_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-iris hover:underline">
          OpenAlex <ArrowSquareOut size={14} />
        </a>
      </Card>
    );
  }

  const { topic, works } = result;

  return (
    <section className="space-y-4">
      {topic ? (
        <div>
          <SectionHeading>{topic.name}</SectionHeading>
          <Card className="p-4">
            <blockquote className="text-[13.5px] leading-relaxed text-ink">{topic.description}</blockquote>
            {topic.keywords.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {topic.keywords.map((keyword) => <li key={keyword}><Pill tone="iris">{keyword}</Pill></li>)}
              </ul>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div>
        <SectionHeading>{result.matchKind === "trial_id" ? "About this study" : "Papers"}</SectionHeading>
        {works.length === 0 ? (
          <Card className="p-4 text-[13px] leading-relaxed text-ink-soft">No close match.</Card>
        ) : (
          <ul className="space-y-2.5">
            {works.map((work) => (
              <Card as="li" key={work.id} className="p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {work.isReview ? <Pill tone="iris">Review</Pill> : null}
                  {work.isOpenAccess ? <Pill tone="mint">Free to read</Pill> : null}
                  <span className="text-[11px] text-ink-faint">{work.citedByCount.toLocaleString()} citations</span>
                </div>
                <h3 className="mt-1.5 text-[13.5px] font-bold leading-snug text-ink">{work.title}</h3>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink-soft">{byline(work)}</p>
                {work.abstractExcerpt ? (
                  <blockquote className="mt-2.5 border-l-[3px] border-rule-strong pl-3 text-[12.5px] leading-relaxed text-ink-soft">{work.abstractExcerpt}</blockquote>
                ) : null}
                <a href={work.openAccessUrl ?? work.doiUrl ?? work.id} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12.5px] font-bold text-iris hover:underline">
                  {work.openAccessUrl ? "Read the paper" : "View the record"} <ArrowSquareOut size={14} />
                </a>
              </Card>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
