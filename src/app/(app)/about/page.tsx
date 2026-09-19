import { X } from "@phosphor-icons/react/dist/ssr";
import { MozaicLockup } from "@/components/Brand";
import { Callout, Card, ScreenHeader, SectionHeading } from "@/components/ui";
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
      <ScreenHeader back="/profile" title="How this works" sub="Mozaic helps you understand what a study would involve and prepare a first conversation with a research coordinator. That is the whole job." />

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
          <p><strong className="text-ink">Public registry records.</strong> {manifest?.recordCount ?? "About 300"} real ClinicalTrials.gov records, retrieved {manifest?.retrievedAt?.slice(0, 10) ?? "recently"} and kept as a fixed snapshot so every screen can say how old its information is.</p>
          <p><strong className="text-ink">OpenAlex.</strong> Background research shown under Insight comes from the OpenAlex open dataset. It explains context. It never bears on whether you could take part, and none of your information is sent to it.</p>
          <p><strong className="text-ink">One fictional study.</strong> Registry records rarely publish a visit schedule, so a clearly labelled invented study supplies one. Its identifier is deliberately not an NCT number, so its details can never be attributed to a real trial.</p>
          <p><strong className="text-ink">What you tell it.</strong> Treated as self-reported and labelled that way wherever it is shown or shared. Nothing is inferred from it: not your sex, not a missing test result, not your treatment history.</p>
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
          <p>This demonstration uses prepared synthetic people. There is no real patient data and no way to type in a free-form medical history.</p>
          <p>Your profile never enters the search index. Contact details are held apart from everything used to search, and are released only through a sharing grant you create.</p>
          <p>The passport QR code contains a random ten-minute link, never your information. Revoking a grant blocks further access inside this app. It cannot recall what someone already read.</p>
          <p>This prototype is <strong className="text-ink">not</strong> HIPAA compliant, and encryption would not make it so. A real deployment needs institutional review, server-side role checks, tenant isolation, documented retention, tested deletion and export, vendor review and incident procedures.</p>
        </Card>
      </section>

      <section>
        <SectionHeading>What has been tested, and what has not</SectionHeading>
        <Card className={prose}>
          <p>Automated checks cover search quality, the assessment rules, that every citation resolves to its exact source span, the burden arithmetic, permission isolation and behaviour when things fail.</p>
          <p>They are engineering checks against synthetic people. Nothing here has been validated with real participants or coordinators, and this project has not shown that it improves enrolment, retention, diversity or any clinical outcome.</p>
        </Card>
      </section>

      <Callout>Leaving Mozaic is not the same as withdrawing from a study. If you are taking part in research, contact that study&rsquo;s team directly.</Callout>
    </div>
  );
}
