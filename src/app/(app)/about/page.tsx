import { X } from "@phosphor-icons/react/dist/ssr";
import { MozaicLockup } from "@/components/Brand";
import { Card, ScreenHeader, SectionHeading } from "@/components/ui";
import { AI_METADATA } from "@/lib/ai";
import { getManifest } from "@/lib/db";

export const dynamic = "force-dynamic";

const WILL_NOT = [
  "Decide whether you are eligible. Only a study's investigators can, after their own screening.",
  "Diagnose anything, recommend a treatment, or interpret a test result.",
  "Take your consent. A study's consent process is separate and run by its staff.",
  "Guess at information it does not have. A missing fact stays visibly missing.",
  "Estimate a visit schedule that a study has not published.",
  "Enrol you, share anything, or contact anyone without you choosing to.",
  "Watch for medical emergencies. If something is wrong, contact your care team or emergency services.",
];

export default function AboutPage() {
  const manifest = getManifest() as { recordCount?: number; retrievedAt?: string } | null;
  const prose = "space-y-2.5 p-4 text-[13px] leading-relaxed text-ink-soft";

  return (
    <div className="space-y-5">
      <ScreenHeader back="/profile" title="How this works" />

      <MozaicLockup className="h-9 w-auto" />

      <section>
        <SectionHeading>What it will not do</SectionHeading>
        <Card className="p-4">
          <ul className="space-y-2.5">
            {WILL_NOT.map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-soft">
                <X size={16} weight="bold" className="mt-0.5 shrink-0 text-blush" />{item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeading>Where the information comes from</SectionHeading>
        <Card className={prose}>
          <p><strong className="text-ink">Public registry records.</strong> {manifest?.recordCount ?? "About 300"} ClinicalTrials.gov records, retrieved {manifest?.retrievedAt?.slice(0, 10) ?? "recently"}.</p>
          <p><strong className="text-ink">OpenAlex.</strong> Background reading on the study topic.</p>
          <p><strong className="text-ink">What you tell it.</strong> Treated as self-reported. Nothing is inferred from missing answers.</p>
        </Card>
      </section>

      <section>
        <SectionHeading>How the matching works</SectionHeading>
        <Card className={prose}>
          <p>Search combines two keyword rankings, one over study titles and conditions and one over individual eligibility criteria, and reports which backend answered and how long it took.</p>
          <p>The criterion observations come from a rule engine, not a language model, so they are reproducible and can be checked. A model is only used to put a study&rsquo;s own words into plainer language, and every quote it produces is verified against the source before it is shown.</p>
          <p>An exclusion criterion that applies to you is reported as something to review, never as a match. Anything that depends on laboratory results or organ function always goes to staff review.</p>
          <p className="text-[11.5px] text-ink-faint">Language model: {AI_METADATA.configured ? `${AI_METADATA.model}, prompt version ${AI_METADATA.promptVersion}` : "none configured. Briefs are assembled by rule, directly from the records."}</p>
        </Card>
      </section>

      <section>
        <SectionHeading>Privacy</SectionHeading>
        <Card className={prose}>
          <p>Your profile never enters the search index. Contact details are released only when you share them.</p>
          <p>The passport QR code is a short-lived link, not your information. Revoking a grant stops further access in this app.</p>
        </Card>
      </section>

      <section>
        <SectionHeading>What has been tested, and what has not</SectionHeading>
        <Card className={prose}>
          <p>Automated checks cover search, matching, citations, and permissions.</p>
        </Card>
      </section>
    </div>
  );
}
