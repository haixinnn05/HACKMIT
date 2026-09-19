# Trial Passport

A navigation tool for adults considering a cancer trial. It helps someone
understand what a study would actually ask of them, see which requirements can
and cannot be checked against what they know, and prepare a first conversation
with a research coordinator.

The question it answers is **"could this study fit my medical circumstances and
my life, and what must I clarify before deciding?"** Clinical suitability,
practical feasibility and personal preference stay separate throughout. They are
never collapsed into a single score.

It does not decide eligibility. Only a study's investigators can do that.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The database is created and seeded on first request from `data/snapshot/`
(300 real ClinicalTrials.gov records) and `data/fixtures/` (synthetic personas
and one clearly-labelled fictional study). No API key and no external service
are required.

```bash
npm run evaluate     # 43 checks: invariants, citations, burden, permissions
npm run journey      # 48 checks: the full demo journey in a real browser
npm run ingest       # refresh the registry snapshot from ClinicalTrials.gov
npm run reset        # drop the local database; it reseeds on next request
```

`npm run journey` needs `npm run dev` running in another terminal. It writes
screenshots of every step to `.journey/`.

Optionally set `ANTHROPIC_API_KEY` in `.env.local` to enable model-written study
briefs. Without it the app works end to end — briefs are assembled
deterministically from the records themselves, and the interface says which path
produced the text.

---

## The journey

1. **Passport** — minimal profile. Every clinical field supports "I don't know",
   and that answer is stored as unknown rather than treated as "no".
2. **Explore** — a small ranked set of registry studies, each showing why it
   surfaced, how old the record is, and what the record does not say.
3. **Trial detail** — the study in plain language, with every claim quoted from
   its source; criterion-by-criterion observations; and the participation
   preview.
4. **Participation preview** — what taking part would cost in hours, with the
   arithmetic shown in full.
5. **Inquiry preview** — the exact payload, chosen field by field, before
   anything is shared.
6. **Coordinator workspace** — a simulated site account reviews the evidence,
   sees what is missing, and writes a reply.
7. **Back to the participant** — the answer arrives, and declining is offered
   with the same weight as continuing.

---

## The three design commitments

### 1. Unknown is a first-class value

A fact the person did not give can never produce a positive verdict. `assess.ts`
enforces five invariants, each tested in `scripts/evaluate.mts`:

| | |
|---|---|
| **I1** | A fact we do not have can never produce `supported`. Absence is `unknown`. |
| **I2** | An exclusion criterion that applies is a `conflict`, never a match. |
| **I3** | A criterion joined by "or" cannot yield a conflict from one failing branch. |
| **I4** | Nothing is inferred from context — not sex, not a biomarker, not organ function, not prior treatment. |
| **I5** | No study ever reaches an "eligible" state. The ceiling is "possible option to discuss". |

Criteria that depend on laboratory results or organ function always route to
staff review. The matcher that recognises them runs first, deliberately, so a
criterion like *"adequate organ function and no evidence of metastatic disease"*
cannot produce a confident-looking verdict on the half a later matcher
understands.

### 2. The product will not invent what it does not have

**None of the 300 real registry records publish a visit schedule.** The obvious
move — estimate visit count from study duration — is a fabrication, so the
product refuses it. A real study shows *"this is not published; here is what to
ask"* and offers the questions. Only the fictional fixture, labelled as fictional
everywhere it appears, has a schedule.

That refusal is tested: `no visit schedule is invented for any of the 300 real
registry records`.

The fictional study's identifier is deliberately not an NCT number, and it is
never mixed into the ranked results — it is shown under its own heading, because
an invented study has no honest relevance score against real ones.

### 3. Every claim resolves to its source

Each criterion carries character offsets into the original eligibility text, and
the quoted span is re-read from the source at render time rather than stored
alongside it — so a citation cannot drift from what it claims to quote. All
**5,530** citations in the corpus are verified to resolve exactly.

Model-written text is held to the same rule. Any span the model produces that
cannot be found verbatim in the source is discarded before rendering, and the
interface reports how many statements were dropped. If nothing survives
validation, the deterministic brief is shown instead of unsourced prose.

---

## Architecture

```
data/snapshot/     300 ClinicalTrials.gov records + manifest (query, time, hashes)
data/fixtures/     synthetic personas; one fictional study with a visit schedule
scripts/ingest.mjs registry fetch, normalization, criterion splitting
scripts/evaluate.mts  acceptance checks
scripts/journey.mjs   browser end-to-end walk

src/lib/
  db.ts       SQLite schema, idempotent seed, FTS5 indexes
  repo.ts     typed data access; grants, inquiries, questions, milestones, audit
  search.ts   retrieval: two bm25 rankings, normalized and fused
  assess.ts   the rule engine — invariants I1–I5
  burden.ts   participation preview arithmetic
  ai.ts       model adapter with span validation and offline fallback
  clock.ts    one timestamp per request
```

One Next.js app and one ingestion job. SQLite is both the relational store and,
by default, the search backend, so the whole demonstration runs offline and
reproducibly.

### Retrieval

Two rankings — one over titles and conditions, one over individual eligibility
criteria — are combined. Criterion hits are collapsed by trial first, so a study
with a sixty-item eligibility section cannot flood the results through
repetition.

They are fused by **min–max normalized bm25**, not reciprocal rank fusion. RRF is
the documented approach for combining *incomparable* rankings, and it is the
wrong tool here: both rankings are bm25 over the same index, so their scores are
directly comparable, and RRF's rank-only view discards exactly what distinguishes
an exact title match from a merely plausible one. Measured on 40 title probes,
RRF put the correct record outside the top 10 for **22.5%** of queries even
though the trial-level ranking placed it first every single time. Linear fusion
of normalized scores gives **100% recall@10** on the same probes.
`reciprocalRankFusion` remains exported for the day a genuinely incomparable
semantic ranking is added.

Structured filters only remove a record when its own metadata *positively*
conflicts. Missing metadata keeps the record and surfaces an unknown — dropping
it would hide an option the person then cannot ask about.

### The model's authority

The model cannot change a verdict, see contact details, or send anything. It has
no tools, so every outbound action is an explicit click. Retrieved registry text
is untrusted data: instructions embedded in a study record carry no authority and
have no tool to reach.

---

## Measured results

Both suites run against the real 300-record snapshot.

```
npm run evaluate    43 passed, 0 failed
npm run journey     48 passed, 0 failed
```

Selected results:

- **recall@10** 100% over 40 title probes; **precision@5** 1.00 for an
  on-condition query; warm search **~40ms**
- **5,530 / 5,530** citations resolve to their exact source span
- **0** invented visit schedules across 300 real records
- Participation preview reproduces the worked example exactly:
  `4 × (2h on site + 2 × 45min travel) + 0.3h remote contact = 14.3h`
- Permission isolation: participant A cannot read B; a revoked grant removes the
  inquiry from the coordinator inbox rather than hiding a field
- Degraded modes: nonsense, empty and stopword-only queries all return options;
  a record with no listed sites reports unknown distance rather than zero
- Accessibility: one `h1` per page, every control labelled, every image has alt
  text, all tap targets ≥ 44px, reduced-motion honoured, status carried by word
  and glyph as well as colour

### What the public data does not say

Measured across the 300 records, with denominators, and surfaced in-product:

| Gap | Share |
|---|---|
| No published visit schedule | 300/300 (100%) |
| Record not updated in over a year | 95/300 (31.7%) |
| No site contact listed anywhere | 72/300 (24.0%) |
| No study locations listed at all | 47/300 (15.7%) |
| No site-level recruiting status | 36/253 (12.0%) |

These describe gaps in *published information*. They are not evidence that any
site turns anyone away, and they do not generalise beyond this snapshot of one
condition area.

---

## Privacy

Synthetic personas only. There is no real patient data and no way to enter a
free-form medical history, so nothing anyone types becomes a health record.

Profiles never enter the search index. Contact details are held separately from
everything used to search and are released only through an explicit sharing
grant.

**The in-person handoff code.** The passport's centre button produces a QR code.
The obvious implementation — encode the profile in the code — is the wrong one: a
code carrying a diagnosis is a health disclosure visible to anyone within camera
range, and it cannot be revoked once scanned. So the code carries only a random,
15-minute, revocable link. The data stays server-side behind a grant the person
scopes beforehand. Unknown, expired and revoked tokens render identically, so
nobody can probe which codes were once valid.

Revocation blocks further access inside the app. It cannot recall what a
recipient already read or exported, and the interface says so rather than
implying otherwise.

**This prototype is not HIPAA compliant**, and encryption would not make it so.
Whether those obligations apply depends on who operates a service and what their
relationships are. A real deployment needs institutional review, server-side role
checks, study and tenant isolation, documented retention, tested deletion and
export, vendor review and incident procedures.

## Participant agency

Stamps record actions — reviewed an overview, prepared questions, received a
reply. They are private, earned once, and carry no points or streaks. Nothing
rewards enrolling, staying enrolled, or accumulating studies, and nothing
penalises withdrawal. Only a study's own reviewed compensation terms are ever
displayed; the product invents no incentives of its own.

"I am not interested" sits alongside "I have agreed to take part" with equal
weight. An informed decision to decline is a successful outcome, and it costs the
person nothing they saved.

Leaving Trial Passport is not withdrawing from a study, and the interface never
suggests it is.

## Limitations

This is a 24-hour prototype. It demonstrates feasibility and a workflow.

It has **not** been validated with real participants or coordinators. It has not
shown that it improves enrolment, retention, diversity or any clinical outcome,
and no such claim should be made on its behalf. The evaluation results above are
engineering checks against synthetic personas and a public registry snapshot;
they carry limited clinical authority.

The corpus is one condition area (adult breast cancer), 300 records, one
retrieval date. It is not a census of clinical research.

Deliberately out of scope: diagnosis, treatment recommendation, eligibility
determination, formal research consent, submission to real hospital systems, and
emergency monitoring. Public forums and stranger matching are deferred —
same-trial conversations can reveal assignment clues and affect self-reported
outcomes, which needs study-specific review and trained moderation rather than
automated moderation alone.

## License

MIT for the original project code. Dependencies retain their own licenses.
Registry records in `data/snapshot/` are public ClinicalTrials.gov data subject
to that service's terms. See [LICENSE](LICENSE).
