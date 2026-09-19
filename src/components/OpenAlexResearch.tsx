import { ArrowSquareOut, BookOpenText, CloudSlash, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { Callout, Card, Pill, SectionHeading } from "@/components/ui";
import { getOpenAlexResearch, OPENALEX_DATASET_URL, type OpenAlexWork } from "@/lib/openalex";
import type { Trial } from "@/lib/types";

/**
 * Insight: the medical background behind a study, from the OpenAlex open index
 * of scholarly work.
 *
 * It exists for someone who does not yet understand what a trial is for. It
 * shows OpenAlex's own description of the research area, its key terms, and
 * review articles with the opening of each abstract. Everything is quoted from
 * OpenAlex and labelled as such; nothing is reworded or generated here.
 *
 * It is kept visibly apart from the study's own requirements. A paper can
 * explain the context. It cannot establish anyone's eligibility or a site's
 * local procedure. The search uses public trial fields only, so no passport data
 * ever reaches OpenAlex.
 */

function byline(work: OpenAlexWork): string {
  const authors = work.authors.length ? `${work.authors.join(", ")}${work.authors.length === 3 ? ", et al." : ""}` : "Authors not listed";
  // "et al." already ends in a period, so joining must not add a second one.
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
      <Callout tone="neutral" icon={<CloudSlash size={20} />} title="Background research is unavailable right now">
        OpenAlex could not be reached and there is no saved copy for this study yet. Everything else
        on this page still works.{" "}
        <a href={OPENALEX_DATASET_URL} target="_blank" rel="noreferrer" className="font-bold text-iris hover:underline">About OpenAlex</a>
      </Callout>
    );
  }

  const { topic, works } = result;

  return (
    <section className="space-y-4">
      <Callout icon={<Lightbulb size={20} weight="fill" />} title="This is background, not a requirement">
        Reading to help you understand what this study is about. It comes from published
        research, not from the study team, and it says nothing about whether you could take part.
      </Callout>

      {topic ? (
        <div>
          <SectionHeading hint={`How OpenAlex describes this area of research${topic.field ? `, within ${topic.field}` : ""}.`}>
            The research area: {topic.name}
          </SectionHeading>
          <Card className="p-4">
            <blockquote className="text-[13.5px] leading-relaxed text-ink">{topic.description}</blockquote>
            <p className="mt-2 text-[11px] text-ink-faint">
              Quoted from OpenAlex, which groups {topic.worksCount.toLocaleString()} papers under this topic.
            </p>
            {topic.keywords.length ? (
              <>
                <p className="mb-1.5 mt-3 text-[12px] font-bold text-ink">Terms you may see, worth asking about</p>
                <ul className="flex flex-wrap gap-1.5">
                  {topic.keywords.map((keyword) => <li key={keyword}><Pill tone="iris">{keyword}</Pill></li>)}
                </ul>
              </>
            ) : null}
          </Card>
        </div>
      ) : null}

      <div>
        <SectionHeading
          hint={result.matchKind === "trial_id"
            ? `Publications indexed with this study's identifier (${trial.id}).`
            : `Matched to "${result.query}". These cover the same topic and may not report on this specific study.`}
        >
          {result.matchKind === "trial_id" ? "Publications about this study" : "Reviews and key papers"}
        </SectionHeading>

        {works.length === 0 ? (
          <Card className="p-4 text-[13px] leading-relaxed text-ink-soft">OpenAlex does not index a close match for this topic.</Card>
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
                  <>
                    <p className="mb-1 mt-2.5 text-[11px] font-bold text-ink-soft">From the abstract</p>
                    <blockquote className="border-l-[3px] border-rule-strong pl-3 text-[12.5px] leading-relaxed text-ink-soft">{work.abstractExcerpt}</blockquote>
                  </>
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

      <p className="flex items-start gap-2 rounded-[14px] bg-sunken px-3.5 py-3 text-[11.5px] leading-relaxed text-ink-faint">
        <BookOpenText size={16} className="mt-0.5 shrink-0 text-iris" />
        <span>
          {result.fromSnapshot
            ? `OpenAlex could not be reached, so this is the copy saved on ${result.fetchedAt.slice(0, 10)}.`
            : `From OpenAlex, retrieved ${result.fetchedAt.slice(0, 10)}.`}{" "}
          Text is quoted as published and not reworded. Research papers are written for specialists,
          so bring anything unclear to your care team. Data from the{" "}
          <a href={OPENALEX_DATASET_URL} target="_blank" rel="noreferrer" className="font-bold text-iris hover:underline">OpenAlex dataset</a>
          , licensed CC0. Your passport data is never sent to OpenAlex.
        </span>
      </p>
    </section>
  );
}
