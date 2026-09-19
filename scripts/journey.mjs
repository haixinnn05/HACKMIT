/**
 * End-to-end check of the demo journey, run against a live dev server.
 *
 * Exercises the path the demonstration actually walks: passport -> find the
 * study -> read the evidence -> preview the burden -> add a question -> share an
 * inquiry -> coordinator answers it -> participant sees the answer. Screenshots
 * are written to .journey/ for the demo recording.
 *
 * Usage: npm run dev, then `node scripts/journey.mjs`
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = ".journey";
mkdirSync(SHOTS, { recursive: true });

let step = 0;
const results = [];

function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail && !condition ? ` — ${detail}` : ""}`);
}

async function shot(page, name) {
  step += 1;
  await page.screenshot({ path: `${SHOTS}/${String(step).padStart(2, "0")}-${name}.png`, fullPage: true });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on("pageerror", (error) => console.log(`  [page error] ${error.message}`));

console.log("\nTrial Passport — end-to-end journey\n");

// Start from the seeded state so each run is independent. Without this, an
// inquiry left by a previous run makes the revocation check pass vacuously.
await page.request.post(`${BASE}/api/reset`);

/* 1. Become the demo persona. */
await page.goto(`${BASE}/passport`, { waitUntil: "networkidle" });
await page.selectOption("select", "p-maria");
await page.waitForTimeout(700);
await page.goto(`${BASE}/passport`, { waitUntil: "networkidle" });
assert("passport loads for the demo persona",
  (await page.content()).includes("Maria Restrepo"));
assert("unknown facts are surfaced as unknown, not as 'no'",
  (await page.content()).includes("HER2 status"));
await shot(page, "passport");

/* 2. Explore. */
await page.goto(`${BASE}/explore`, { waitUntil: "networkidle" });
const exploreHtml = await page.content();
assert("explore separates the demonstration study from registry results",
  exploreHtml.includes("Demonstration study") && exploreHtml.includes("From the public registry"));
// The product may *deny* that it decides eligibility; it must never assert it.
assert("no card claims the person qualifies",
  !/\b(you qualify|you are eligible|you meet the criteria)\b/i.test(
    exploreHtml.replace(/whether you qualify|you qualify — only study staff can decide that/gi, "")
  ));
assert("cards state a provisional verdict only",
  /Potential option to discuss|Needs more information|Something may not match/.test(exploreHtml));
await shot(page, "explore");

/* 3. A real registry record: evidence, and no invented schedule. */
const realLink = await page.locator('a[href^="/trial/NCT"]').first().getAttribute("href");
await page.goto(`${BASE}${realLink}`, { waitUntil: "networkidle" });
const realHtml = await page.content();
assert("a real record refuses to estimate a visit schedule",
  realHtml.includes("visit schedule is not published"));
assert("a real record offers questions instead of a number",
  realHtml.includes("Worth asking the study team"));
assert("the original registry wording is available to open",
  realHtml.includes("Show the exact wording from the record"));
await shot(page, "real-trial-no-schedule");

/* 4. The fictional study: participation preview with real arithmetic. */
await page.goto(`${BASE}/trial/TP-FIX-001`, { waitUntil: "networkidle" });
let html = await page.content();
assert("the fictional study is labelled as fictional", html.includes("Fictional study."));
assert("the participation preview totals 14.3 hours", html.includes(">14.3<"));
assert("the arithmetic is shown in full, and adds up to the stated total",
  html.includes("4 × (2h on site + 2 × 45min travel) + 0.3h remote contact = 14.3h"));
assert("waiting time is declared excluded", html.includes("Waiting time at the clinic"));
assert("each input shows where it came from",
  html.includes("Confirmed by simulated staff") && html.includes("You entered this"));
await shot(page, "participation-preview");

/* 5. A what-if is labelled hypothetical. */
await page.goto(`${BASE}/trial/TP-FIX-001?visits=2&travel=45`, { waitUntil: "networkidle" });
html = await page.content();
assert("a what-if schedule is labelled as not agreed by the study",
  html.includes("The study has not agreed to it"));
assert("the what-if recomputes the total", html.includes(">7.3<"));
await shot(page, "what-if");

/* 6. Add a question the record cannot answer. */
await page.goto(`${BASE}/trial/TP-FIX-001`, { waitUntil: "networkidle" });
await page.fill("#question-text", "Is parking covered at the study site?");
await page.click('button:has-text("Add question")');
await page.waitForLoadState("networkidle");
html = await page.content();
assert("the question is saved to the passport queue",
  html.includes("Is parking covered at the study site?"));
await shot(page, "question-added");

/* 7. Inquiry preview: exact payload, chosen by the person. */
await page.goto(`${BASE}/inquiry/new/TP-FIX-001`, { waitUntil: "networkidle" });
html = await page.content();
assert("the inquiry preview shows the exact payload before sharing",
  html.includes("What you are sharing") && html.includes("Nothing has been shared yet"));
assert("contact details are off by default",
  !(await page.locator('input[value="contact"]').isChecked()));
assert("the draft carries the participant's unknowns",
  html.includes("I don&#x27;t know") || html.includes("do not know"));
assert("the draft states the burden figure",
  (await page.locator("#message").inputValue()).includes("14.3 hours"));
await shot(page, "inquiry-preview");

/* 8. Share it. */
await page.click('button:has-text("Share this inquiry")');
// A server action redirect settles the client router after the network goes
// quiet, so wait on the URL rather than on network state.
await page.waitForURL(/\/inquiry\/[0-9a-f-]{36}/, { timeout: 20000 });
const inquiryUrl = page.url();
assert("sharing lands on the inquiry's status page", /\/inquiry\/[0-9a-f-]{36}/.test(inquiryUrl));
html = await page.content();
assert("acknowledgement is not presented as enrolment",
  html.includes("Shared, waiting to be picked up"));
await shot(page, "inquiry-shared");

/* 9. Coordinator side. */
await page.goto(`${BASE}/coordinator`, { waitUntil: "networkidle" });
html = await page.content();
// Scope to the inbox list: the persona switcher in the nav also names personas,
// so a whole-page text match would pass even with an empty inbox.
const inboxItems = page.locator('a[href^="/coordinator/"]:not([href$="/coordinator"])');
assert("the inquiry reaches the coordinator inbox", (await inboxItems.count()) === 1);
assert("the inbox item names the participant",
  (await inboxItems.first().textContent()).includes("Maria Restrepo"));
assert("the staff account is labelled simulated", html.includes("Simulated staff account"));
await shot(page, "coordinator-inbox");

await page.locator('a[href^="/coordinator/"]:not([href$="/coordinator"])').first().click();
await page.waitForURL(/\/coordinator\/[0-9a-f-]{36}/, { timeout: 20000 });
await page.waitForLoadState("networkidle");
html = await page.content();
assert("the coordinator sees only authorised fields",
  html.includes("Participant-authorised information"));
assert("contact details were not shared and the UI says so",
  html.includes("did not share contact details"));
assert("criterion observations carry their source wording",
  html.includes("Provisional criterion observations") && html.includes("eligibility criteria"));
assert("missing information is listed for the coordinator to request",
  html.includes("Missing information to request"));
assert("a site-policy answer is pre-filled for the parking question",
  html.includes("validated at the Harborview garage"));
assert("the pre-filled answer is marked as needing human review",
  html.includes("Edit it") && html.includes("you are the author"));
await shot(page, "coordinator-review");

/* 10. Coordinator sends the reviewed answer. */
await page.click('button:has-text("Send this answer")');
await page.waitForSelector('text=Sent by R. Alvarez', { timeout: 20000 });
html = await page.content();
assert("the sent answer is attributed to the person who sent it",
  html.includes("Sent by R. Alvarez"));
await shot(page, "coordinator-answered");

/* 11. Back to the participant: the answer arrived. */
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
html = await page.content();
assert("the participant's home surfaces the reply", html.includes("You have a reply"));
assert("stamps are shown as a private record", html.includes("Your passport stamps"));
await shot(page, "home-with-reply");

await page.goto(inquiryUrl, { waitUntil: "networkidle" });
html = await page.content();
assert("the participant can read the full answer",
  html.includes("validated at the Harborview garage"));
assert("the answer states who wrote it", html.includes("R. Alvarez"));
assert("declining is offered as a first-class choice",
  html.includes("I am not interested"));
await shot(page, "participant-answer");

/* 12. Revocation removes the inquiry from the site. */
await page.goto(`${BASE}/passport`, { waitUntil: "networkidle" });
assert("the sharing grant is listed with what it covered",
  (await page.content()).includes("Who can see what"));
await page.locator('button:has-text("Revoke")').first().click();
await page.waitForSelector('text=Revoked', { timeout: 20000 });
assert("revocation is honest about what it cannot undo",
  (await page.content()).includes("cannot recall information someone"));
await shot(page, "revoked");

await page.goto(`${BASE}/coordinator`, { waitUntil: "networkidle" });
assert("the revoked inquiry is gone from the coordinator inbox",
  (await page.locator('a[href^="/coordinator/"]:not([href$="/coordinator"])').count()) === 0);
assert("the coordinator sees an empty inbox rather than a stale item",
  (await page.content()).includes("Nothing waiting"));
await shot(page, "coordinator-after-revoke");

/* 13. The in-person handoff code. */
await page.goto(`${BASE}/passport`, { waitUntil: "networkidle" });
await page.click('button[aria-haspopup="dialog"]');
await page.waitForSelector('text=My passport code');
html = await page.content();
assert("the code dialog states that the code carries no health information",
  html.includes("contains") && html.includes("no health information"));
assert("contact sharing is off by default in the code dialog",
  !(await page.locator('input[type="checkbox"]').last().isChecked()));
await page.click('button:has-text("Create code")');
await page.waitForSelector("img[alt*='Scannable code']", { timeout: 20000 });
const handoffUrl = await page.locator("p.font-mono").first().textContent();
assert("the code encodes a URL and nothing else",
  /^http:\/\/localhost:3000\/handoff\/[0-9a-f-]{36}$/.test(handoffUrl.trim()), handoffUrl);
assert("the URL contains no condition, trial id or credential",
  !/breast|cancer|NCT|TP-FIX|maria/i.test(handoffUrl));
await shot(page, "passport-code");

// What a coordinator sees after scanning.
const scanner = await context.newPage();
await scanner.goto(handoffUrl.trim(), { waitUntil: "networkidle" });
let scanned = await scanner.content();
assert("scanning shows only the fields the person chose",
  scanned.includes("Maria Restrepo") && scanned.includes("Practical situation"));
assert("unshared contact details are absent and explained",
  !scanned.includes("maria.demo@example.com") &&
  scanned.includes("did not share contact details"));
assert("scanned facts the person does not know say so",
  scanned.includes("the participant does not know"));
assert("the scanned view states the information is unverified",
  scanned.includes("not been checked against medical records"));
await scanner.screenshot({ path: `${SHOTS}/18-scanned-handoff.png`, fullPage: true });

// Revoking the code closes it immediately.
await page.click('button:has-text("Done")');
await page.goto(`${BASE}/passport`, { waitUntil: "networkidle" });
await page.locator('button:has-text("Revoke")').first().click();
await page.waitForSelector("text=Revoked", { timeout: 20000 });
await scanner.goto(handoffUrl.trim(), { waitUntil: "networkidle" });
scanned = await scanner.content();
assert("a revoked code stops resolving", scanned.includes("This code is not active"));
assert("a revoked code leaks nothing about who it belonged to",
  !scanned.includes("Maria Restrepo"));
await scanner.close();

/* 14. Access gaps. */
await page.goto(`${BASE}/access-gaps`, { waitUntil: "networkidle" });
html = await page.content();
assert("missingness is reported with denominators",
  (await page.locator("text=/\\d+\\s*\\/\\s*\\d+/").count()) > 0);
assert("gaps are not presented as discrimination",
  html.includes("not evidence that a site turns anyone away"));
await shot(page, "access-gaps");

/* 15. Accessibility basics. */
await page.goto(`${BASE}/trial/TP-FIX-001`, { waitUntil: "networkidle" });
const a11y = await page.evaluate(() => {
  // WCAG 2.2 target size applies to the *interactive region*, which for a
  // checkbox is its enclosing label, not the 20px box. Inline text links inside
  // a paragraph are exempt, and the skip link is sized only once focused.
  const small = [...document.querySelectorAll("button, a, input, select, textarea")].filter(
    (element) => {
      if (element.closest("summary") || element.classList.contains("sr-only")) return false;
      if (element.tagName === "A" && element.closest("p, li, dd")) return false;
      const region = element.closest("label") ?? element;
      const rect = region.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.height < 40;
    }
  );
  return {
    h1Count: document.querySelectorAll("h1").length,
    unlabelledInputs: [...document.querySelectorAll("input, select, textarea")].filter(
      (element) =>
        !element.getAttribute("aria-label") &&
        !element.closest("label") &&
        !document.querySelector(`label[for="${element.id}"]`) &&
        element.type !== "hidden"
    ).length,
    imagesWithoutAlt: [...document.querySelectorAll("img")].filter((img) => !img.alt).length,
    smallTapTargets: small.length,
    langSet: document.documentElement.lang === "en",
  };
});
assert("exactly one h1 per page", a11y.h1Count === 1, `found ${a11y.h1Count}`);
assert("every form control has a label", a11y.unlabelledInputs === 0, `${a11y.unlabelledInputs} unlabelled`);
assert("every image has alt text", a11y.imagesWithoutAlt === 0);
assert("document language is declared", a11y.langSet);
assert("tap targets are at least 40px tall", a11y.smallTapTargets === 0, `${a11y.smallTapTargets} too small`);

await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(`\n${"=".repeat(56)}`);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) {
  console.log("\nFailures:");
  for (const failure of failed) console.log(`  - ${failure.name}${failure.detail ? ` (${failure.detail})` : ""}`);
}
console.log(`screenshots in ${SHOTS}/`);
console.log("=".repeat(56));
process.exit(failed.length > 0 ? 1 : 0);
