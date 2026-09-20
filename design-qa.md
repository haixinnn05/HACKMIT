# Mozaic design QA

## Evidence

- Source visual truth: `/Users/jacksonwu/.codex/generated_images/01a0bb42-36ef-77a0-a5dc-27b2d061b6c1/exec-4696bedf-1bfc-4caf-a893-407faf655400.png`
- Source pixels: 1472 x 1068. The source is a three-screen presentation board; each app frame represents a 390 x 844 mobile target.
- Browser implementation: `http://localhost:3000/`, `/passport`, and a generated `/handoff/[token]` route.
- Collaborative browser viewport: 390 x 844 CSS px, device scale factor 2; captured snapshots were 780 x 1688 px.
- Full-page implementation screenshots:
  - `.journey/12-home-with-reply.png` — 860 x 3948 px, 430 CSS px wide at device scale factor 2.
  - `.journey/01-passport.png` — 860 x 8276 px, 430 CSS px wide at device scale factor 2.
  - `.journey/18-scanned-handoff.png` — 860 x 3490 px, 430 CSS px wide at device scale factor 2.
- State: participant Home, participant Passport before and after generating a code, and researcher read-only view opened from that code.
- Density normalization: layout and crop were judged at the 390 x 844 CSS viewport in the collaborative browser. The 2x full-page captures were used for readable focused-region checks, not direct pixel subtraction against the presentation board.

## Full-view comparison

The implementation preserves the source hierarchy across all three screens: an unboxed editorial journey on Home, a dominant aubergine ticket on Passport, and a flat read-only details list for the researcher. The primary violet, aubergine, blue information surface, pale-yellow current-step label, white canvas, and near-black typography align with the selected visual direction. The prototype safety banner and persona switcher remain above the app content intentionally because this repository uses synthetic personas and must not be mistaken for a live medical service.

## Focused-region comparison

- Home journey: the numbered rail, completed solid segment, dotted future segment, active-step marker, yellow status label, and violet action match the source hierarchy. The active step is data-driven, so later end-to-end states correctly advance from step 2 to step 4.
- Passport ticket: the dark ticket surface, side notches, perforated divider, readiness meter, privacy statement, and QR position match the source. Before generation the QR position uses the product icon; after generation it contains the real scannable code.
- Sharing controls: the selected rows, unshared contact state, short-lived-link explanation, and ten-minute CTA are legible and function as shown.
- Researcher view: the private-access banner, read-only details rows, missing-contact disclosure, unknown values, and unverified-information notice match the source structure and privacy intent.

## Required fidelity surfaces

- Fonts and typography: Plus Jakarta Sans is used throughout. Display weights, tight headline tracking, readable body sizing, and uppercase micro-label spacing match the source closely. No truncation occurs in app content at 390 px.
- Spacing and layout rhythm: sections sit directly on the white page; dividers replace unnecessary cards. Mobile margins, ticket proportions, row spacing, and bottom-navigation clearance are consistent. Full pages retain safe bottom padding.
- Colors and visual tokens: white, near-black, electric violet, deep aubergine, cobalt-blue information surfaces, and pale yellow status are consistent with the source and retain readable contrast.
- Image and asset fidelity: no raster illustration is required by the selected source. UI icons use the Phosphor icon library. The visible sharing code is generated from the real short-lived handoff URL rather than a placeholder.
- Copy and content: the journey language, privacy language, participant-selected fields, unknown-value treatment, researcher read-only state, and lack of eligibility claims are preserved.

## Comparison history

- Iteration 1 — P1: the researcher view inherited a second handoff header from its route layout, creating duplicate Mozaic chrome. Fix: removed the redundant route-layout header and wrapper, leaving the page-owned researcher header as the single visual shell.
- Post-fix evidence: the final collaborative-browser researcher snapshot at 390 x 844 and `.journey/18-scanned-handoff.png` show one brand header, one `Shared passport` heading, and one read-only content column.

## Interaction and accessibility verification

- Tested Home navigation and the data-driven active journey step.
- Tested Passport share selections and the `Create 10-minute sharing code` action.
- Confirmed the generated QR is replaced with a real scannable image and a short-lived URL.
- Opened the generated handoff URL and confirmed participant-selected data, unknown fields, unshared contact details, expiry, and read-only language.
- Checked browser console output. No application page errors were observed; the collaborative preview shell emitted an Electron preload error outside the app, while the page and interactions continued normally.
- Automated checks confirm one H1 per page, labelled controls, image alt text, document language, and minimum tap-target sizing.

## Findings

- No actionable P0, P1, or P2 visual or interaction mismatches remain.

## Follow-up polish

- P3: the prototype warning and persona switcher add height above the mobile source composition. They are intentionally retained as demonstration safeguards.
- P3: the generated concept shows a decorative `Open passport` control inside the ticket. The implementation instead puts the functional sharing action immediately below the ticket, avoiding a redundant button on the Passport page.

## Implementation checklist

- [x] Journey-led Home implemented.
- [x] Ticket-style participant Passport implemented.
- [x] Selective ten-minute QR sharing implemented.
- [x] Read-only researcher view implemented.
- [x] Mobile and desktop build passed.
- [x] End-to-end privacy and accessibility checks passed.

final result: passed
