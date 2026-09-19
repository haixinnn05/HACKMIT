import Link from "next/link";
import { Card, Note, SectionHeading } from "@/components/ui";
import { AI_METADATA } from "@/lib/ai";
import { getManifest } from "@/lib/db";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** What this is, what it refuses to do, and where its data comes from. */
export default function AboutPage() {
  const manifest = getManifest() as any;

  return (
    <div className="space-y-5">
      <Link href="/passport" className="inline-flex min-h-11 items-center text-sm text-teal hover:underline">← My passport</Link>

      <div className="page-intro">
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-teal">Clear about the limits</p>
        <h1 className="text-3xl font-semibold tracking-[-0.025em] text-ink">How this works</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Trial Passport helps you understand what taking part in a study would involve and
          prepare a first conversation with a research coordinator. That is the whole job.
        </p>
      </div>

      <section>
        <SectionHeading>What it will not do</SectionHeading>
        <Card className="p-4">
          <ul className="space-y-2 text-sm leading-relaxed text-ink-soft">
            {[
              "Decide whether you are eligible. Only a study's investigators can do that, after their own screening.",
              "Diagnose anything, recommend a treatment, or interpret a test result.",
              "Take your consent. A study's own consent process is separate and is run by its staff.",
              "Guess at information it does not have. A missing fact stays visibly missing.",
              "Estimate a visit schedule that a study has not published.",
              "Enrol you, share anything, or contact anyone without you clicking to do it.",
              "Watch for medical emergencies. If something is wrong, contact your care team or emergency services.",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-0.5 shrink-0 text-clay">✕</span>
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionHeading>Where the information comes from</SectionHeading>
        <Card className="space-y-3 p-4 text-sm leading-relaxed text-ink-soft">
          <div>
            <p className="font-medium text-ink">Public registry records</p>
            <p>
              {manifest?.recordCount ?? "About 300"} real ClinicalTrials.gov records, retrieved{" "}
              {manifest?.retrievedAt?.slice(0, 10) ?? "recently"} and stored as a fixed snapshot so
              every screen can tell you how old its information is. A record being marked
              recruiting does not mean a place is open at a site near you.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">One fictional study</p>
            <p>
              Registry records almost never publish a visit schedule, so a clearly-labelled
              invented study supplies one. It is marked as fictional everywhere it appears and its
              identifier is deliberately not an NCT number, so its invented details can never be
              attributed to a real trial.
            </p>
          </div>
          <div>
            <p className="font-medium text-ink">What you tell it</p>
            <p>
              Everything you enter is treated as self-reported and is labelled that way wherever
              it is shown or shared. It is never checked against medical records, and nothing is
              inferred from it — not your sex, not a missing test result, not your treatment
              history.
            </p>
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading>How the matching works</SectionHeading>
        <Card className="space-y-3 p-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Search combines two keyword rankings — one over study titles and conditions, one over
            individual eligibility criteria — and shows which backend answered and how long it
            took.
          </p>
          <p>
            The criterion observations are produced by a rule engine, not a language model, so
            they are reproducible and can be checked. A language model is used only to put the
            study&rsquo;s own words into plainer language, and every quote it produces is verified
            against the source text before it is shown. Quotes that cannot be found are discarded.
          </p>
          <p>
            An exclusion criterion that applies to you is reported as a possible conflict, never as
            a match. A criterion listing alternatives with &ldquo;or&rdquo; cannot produce a
            conflict from one part not matching. Anything depending on laboratory results or organ
            function is always routed to staff review.
          </p>
          <p className="text-xs text-ink-faint">
            Language model:{" "}
            {AI_METADATA.configured
              ? `${AI_METADATA.model}, prompt version ${AI_METADATA.promptVersion}`
              : "none configured — briefs are assembled by rule, directly from the records"}
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>Privacy</SectionHeading>
        <Card className="space-y-3 p-4 text-sm leading-relaxed text-ink-soft">
          <p>
            This demonstration uses prepared synthetic people. There is no real patient data in it
            and no way to enter a free-form medical history, so nothing anyone types here becomes
            someone&rsquo;s health record.
          </p>
          <p>
            Your profile never enters the search index. Contact details are held separately from
            everything used to search, and are released only through a sharing grant you create.
          </p>
          <p>
            Revoking a grant blocks further access inside this app. It cannot recall anything a
            recipient already read or exported, and it does not change anything held in a
            study&rsquo;s official research records.
          </p>
          <p>
            This prototype is <strong className="font-medium text-ink">not</strong> HIPAA
            compliant, and using encryption would not make it so. Whether those obligations apply
            at all depends on who operates a service and what their relationships are. A real
            deployment would need institutional review, server-side role checks, study and tenant
            isolation, documented retention, tested deletion and export, vendor review and incident
            procedures.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeading>What has been tested, and what has not</SectionHeading>
        <Card className="space-y-3 p-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Running <code className="rounded bg-paper-sunken px-1 font-mono text-xs">npm run evaluate</code>{" "}
            checks discovery quality, the assessment invariants, that every citation resolves to
            its exact source span, the burden arithmetic, permission isolation and behaviour when
            things fail. These are engineering checks against synthetic personas.
          </p>
          <p>
            They do not establish clinical accuracy. Nothing here has been validated with real
            participants or coordinators, and this project has not shown that it improves
            enrolment, retention, diversity or any clinical outcome. No such claim should be made
            on its behalf.
          </p>
          <p>
            Deciding a study is not right for you is a good outcome. This app is built so that
            stopping costs you nothing and nobody chases you afterwards.
          </p>
        </Card>
      </section>

      <Note>
        Leaving Trial Passport is not the same as withdrawing from a study. If you are taking part
        in research, contact that study&rsquo;s team directly.
      </Note>
    </div>
  );
}
