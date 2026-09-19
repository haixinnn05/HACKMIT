/**
 * End-to-end check of the twelve screens, run against a live dev server.
 *
 * Walks the path the demonstration walks: home, find trials, trial detail,
 * participation preview, saved questions, inquiry review, research team reply,
 * inbox, decision, timeline, passport code, scanned profile, revocation.
 * Screenshots go to .journey/.
 *
 * Usage: npm run dev, then `npm run journey`
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = ".journey";
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

let step = 0;
const results = [];
function assert(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${detail && !condition ? ` (${detail})` : ""}`);
}
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on("pageerror", (error) => console.log(`  [page error] ${error.message}`));
const shot = async (name, target = page) => {
  step += 1;
  await target.screenshot({ path: `${SHOTS}/${String(step).padStart(2, "0")}-${name}.png`, fullPage: true });
};
const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
const main = () => page.locator("#main");
const text = async () => (await main().innerText()).replace(/\s+/g, " ");

console.log("\nMozaic: twelve-screen journey\n");
await page.request.post(`${BASE}/api/reset`);
await page.request.post(`${BASE}/api/persona`, { data: { id: "p-maria" } });

/* 1. Home */
await go("/");
let t = await text();
assert("1 Home greets the participant by name", /Good (morning|afternoon|evening), Maria/.test(t));
assert("1 Home shows journey progress out of five", /\d of 5 completed/.test(t));
assert("1 Home offers exactly one next step", (await page.locator("text=Your next step").count()) === 1);
await shot("home");

/* 2. Find Clinical Trials */
await go("/explore");
t = await text();
assert("2 Trials lists a result count", /\d+ trials found/.test(t));
assert("2 Trials keeps the demonstration study apart from registry results", t.includes("Demo study, kept apart") && t.includes("From the public registry"));
assert("2 Trials never says the person qualifies", !/you qualify|you are eligible/i.test(t));
assert("2 Trials cards state recruitment status, site status and record date",
  /recruiting/i.test(t) && /site status (not )?published/.test(t) && /record updated \d{4}-\d{2}/.test(t));
assert("2 Trials cards carry a provisional label", /Potential option|Questions remain|Things to review/.test(t));
await page.selectOption('select[name="phase"]', "PHASE2");
await page.waitForURL(/phase=PHASE2/);
assert("2 Trials phase filter narrows the list", /Phase 2/.test(await text()) && !/Phase 3 \|/.test(await text()));
await shot("trials");

/* 3. Trial Detail */
const realHref = await page.locator('a[href^="/trial/NCT"]').first().getAttribute("href");
await go(realHref);
t = await text();
assert("3 Detail has the three tabs", ["Overview", "Eligibility", "What to Expect"].every((label) => t.includes(label)));
assert("3 Detail shows OpenAlex background research, labelled as not evidence", t.includes("OpenAlex") && t.includes("not evidence"));
await page.fill('input[name="ask"]', "What is the wifi password?");
await page.click('button:has-text("Ask")');
await page.waitForURL(/ask=/);
t = await text();
assert("3 Asking something the record does not cover gets an honest no", t.includes("record does not say") && t.includes("Save this question for the study team"));
assert("3 The answer says how it was found", t.includes("No language model was involved"));
await shot("detail-real");
await go(`${realHref}?tab=expect`);
assert("3 A real record refuses to estimate a time commitment", (await text()).includes("time commitment is not published"));

await go("/trial/TP-FIX-001");
assert("3 The fictional study is labelled fictional", (await text()).includes("Fictional study"));
await page.locator('button:has-text("Save Trial")').click();
await page.waitForSelector('a:has-text("Prepare an inquiry")');
assert("3 Saving swaps the primary action to preparing an inquiry", true);
await go("/trial/TP-FIX-001?ask=" + encodeURIComponent("Do I get paid for taking part?"));
t = await text();
assert("3 Asking something the record covers quotes it word for word",
  t.includes("Payment accrues per visit and does not depend on completing the entire study") && t.includes("quoted word for word"));
await shot("detail-ask");
await go("/trial/TP-FIX-001?tab=eligibility");
t = await text();
assert("3 Eligibility is marked provisional", t.includes("provisional"));
assert("3 Eligibility exposes the exact source wording", t.includes("Show the exact wording from the record"));
assert("3 An unknown biomarker stays unknown", t.includes("HER2 status"));
await shot("detail-eligibility");

/* 4. Participation Preview */
await go("/trial/TP-FIX-001/preview");
await page.locator("summary", { hasText: "How we worked this out" }).click();
t = await text();
assert("4 Preview totals 14.3 hours", t.includes("14.3"));
assert("4 Preview shows arithmetic that adds up", t.includes("4 × (2h on site + 2 × 45min travel) + 0.3h remote contact = 14.3h"));
assert("4 Preview declares waiting time excluded", /waiting time/i.test(t));
assert("4 Preview rows name the six areas", ["Study duration", "Study visits", "Time per visit", "Travel distance", "Possible reimbursement", "Caregiver / support"].every((l) => t.includes(l)));
await shot("preview");
await go("/trial/TP-FIX-001/preview?visits=2&travel=45");
assert("4 A what-if is labelled as not agreed", (await text()).includes("The study has not agreed to it"));
await go(`${realHref}/preview`);
t = await text();
assert("4 A real record shows Not published, never a guess", t.includes("Not published") && t.includes("No total can be shown"));
await shot("preview-real");

/* 5. Saved Questions */
await go("/trial/TP-FIX-001/preview");
await page.locator('button:has-text("Is parking covered")').click();
await page.waitForLoadState("networkidle");
await go("/questions?add=1&trial=TP-FIX-001");
await page.fill('textarea[name="text"]', "Can my family member come with me to visits?");
await page.click('button:has-text("Save question")');
await page.waitForURL(/\/questions/);
await go("/questions");
t = await text();
assert("5 Questions are saved and counted", t.includes("All (2)") && t.includes("Need to ask (2)"));
await shot("questions");

/* 8. Inquiry review */
await go("/inquiry/new/TP-FIX-001");
t = await text();
assert("8 Inquiry review lists what would be shared", ["Personal information", "Relevant medical history", "Travel preferences", "Saved questions"].every((l) => t.includes(l)));
assert("8 Contact details start unticked", !(await page.locator('input[value="contact"]').isChecked()));
assert("8 The message has a live character count", /\d+\/500/.test(t));
assert("8 The autofilled packet carries the burden figure", (await page.locator("#packet").inputValue()).includes("14.3 hours"));
await shot("inquiry-review");
await page.click('button:has-text("Share Inquiry")');
await page.waitForURL(/\/inquiry\/[0-9a-f-]{36}/, { timeout: 20000 });
const inquiryUrl = page.url();
assert("8 Sharing is not presented as enrolment", (await text()).includes("Shared, waiting to be picked up"));

/* 11. Research Team Inbox */
await go("/coordinator");
t = await text();
const items = page.locator('#main a[href^="/coordinator/"]');
assert("11 The inquiry reaches the research team", (await items.count()) === 1 && t.includes("Maria Restrepo"));
assert("11 The staff account is labelled simulated", t.includes("Simulated staff account"));
assert("11 Items are marked patient-authorized", t.includes("Patient-authorized"));
await shot("team-inbox");
await items.first().click();
await page.waitForURL(/\/coordinator\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
t = await text();
assert("11 Eligibility considerations are marked not a decision", t.includes("not a decision"));
assert("11 Considerations group as Supported, Unknown, Needs review", ["Supported", "Unknown", "Needs review"].every((l) => t.includes(l)));
assert("11 Unshared contact details are absent and explained", !t.includes("maria.demo@example.com") && t.includes("did not share contact details"));
assert("11 Missing information is listed to request", t.includes("Missing information to request"));
assert("11 A saved site answer is pre-filled and flagged for review", t.includes("You are the author"));
assert("11 A Reply action stays in reach", (await page.locator('a:has-text("Reply to Maria")').count()) === 1);
await shot("team-review");
const parking = () => page.locator("li", { hasText: "Is parking covered" });
await parking().locator('select[name="assignee"]').selectOption("finance");
await parking().locator('button:has-text("Assign")').click();
await page.waitForSelector("text=Owner: Site finance office");
assert("11 A question can be assigned an owner", (await parking().innerText()).includes("Assigned"));

await parking().locator('button:has-text("Save draft")').click();
await page.waitForSelector("text=A saved draft");
assert("11 A draft is saved with its own state", (await parking().innerText()).includes("Draft answer"));
const peek = await context.newPage();
await peek.goto(inquiryUrl, { waitUntil: "networkidle" });
assert("11 A draft is never visible to the participant", !(await peek.locator("#main").innerText()).includes("validated at the Harborview garage"));
await peek.close();

await parking().locator('button:has-text("Send this answer")').click();
await page.waitForSelector("text=Sent by R. Alvarez", { timeout: 20000 });
assert("11 The reply is attributed to the person who sent it", true);

/* 9. Inbox */
await go("/inbox");
t = await text();
assert("9 Inbox shows the reply as unread", t.includes("Unread (1)") && t.includes("Answered"));
await shot("inbox");
await go("/");
assert("1 Home surfaces the reply", (await text()).includes("You have a reply"));
await page.goto(inquiryUrl, { waitUntil: "networkidle" });
t = await text();
assert("9 The thread shows the full answer and its author", t.includes("validated at the Harborview garage") && t.includes("R. Alvarez"));
assert("9 All four choices are offered, including declining and asking for help",
  ["I have agreed to take part", "I need more time", "Please help me contact the study team", "I am not interested"].every((l) => t.includes(l)));
await shot("thread");
await page.click('button:has-text("I still have a question")');
await page.waitForSelector("text=Reopened");
assert("9 The participant can reopen an answered question", true);
await go("/coordinator");
await page.locator('#main a[href^="/coordinator/"]').first().click();
await page.waitForURL(/\/coordinator\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
assert("11 The team sees it reopened, with the earlier answer kept as history",
  (await text()).includes("Reopened") && (await text()).includes("Earlier answer"));
await page.locator("li", { hasText: "Is parking covered" }).locator('button:has-text("Send this answer")').click();
await page.waitForSelector("text=Sent by R. Alvarez", { timeout: 20000 });
await page.goto(inquiryUrl, { waitUntil: "networkidle" });
await page.click('button:has-text("This answers it")');
await page.waitForSelector("text=You marked this resolved");
assert("9 The participant can mark an answer resolved", true);
await go("/inbox");
assert("9 Opening the thread marks it read", (await text()).includes("Unread (0)"));
await go("/questions?tab=answered");
assert("5 The answered question moves to Answered", (await text()).includes("Answered (1)"));

/* 12. Visits & Timeline */
await page.goto(inquiryUrl, { waitUntil: "networkidle" });
await page.click('button:has-text("I have agreed to take part")');
await page.waitForURL(/\/timeline/, { timeout: 20000 });
t = await text();
assert("12 Agreeing leads to a timeline of confirmed visits", ["Screening visit", "Baseline visit", "Month 3 follow-up", "Month 6 follow-up"].every((l) => t.includes(l)));
assert("12 Visit times are not invented", t.includes("Time to be confirmed"));
assert("12 To-dos come from what the study left unstated", t.includes("Confirm parking details") && t.includes("Plan travel arrangements"));
await shot("timeline");
await page.locator('button[role="checkbox"]').first().click();
await page.waitForSelector('button[role="checkbox"][aria-checked="true"]');
assert("12 A to-do can be ticked and stays ticked", true);
await go("/timeline?view=calendar");
assert("12 Calendar view renders month grids", (await page.locator("#main .grid-cols-7").count()) >= 1);
await shot("calendar");
await go("/");
assert("1 Home reminds of the next visit", (await text()).includes("Screening visit"));
assert("1 The journey is complete after a decision", (await text()).includes("5 of 5 completed"));
await shot("home-complete");

/* 10. Profile */
await go("/profile");
t = await text();
assert("10 Profile shows the person's own words with an Edit control", t.includes("what I'd be signing up for") && t.includes("Edit"));
assert("10 Profile lists its sections", ["My Trial Passport", "Personal Information", "Medical History", "Preferences", "Privacy & Security", "Past / Saved Trials"].every((l) => t.includes(l)));
await shot("profile");
await go("/profile/saved");
assert("10 Saved trials and decisions are listed", (await text()).includes("Taking part"));

/* 6. Passport and 7. Shared Profile */
await go("/passport");
t = await text();
assert("6 Opening the passport shares nothing", t.includes("No code is active"));
await shot("passport");
await page.click('button:has-text("Share QR Code")');
await page.waitForSelector("text=Choose what to share");
assert("6 Contact details are off by default", !(await page.locator('[role="dialog"] input[type="checkbox"]').last().isChecked()));
const [handoffResponse] = await Promise.all([
  page.waitForResponse((response) => response.url().endsWith("/api/handoff")),
  page.click('button:has-text("Create 10-minute code")'),
]);
const handoffUrl = (await handoffResponse.json()).url;
await page.waitForSelector("img[alt*='Scannable code']", { timeout: 20000 });
assert("6 The code counts down", /Expires in \d+:\d\d/.test(await text()));
await shot("passport-code");
const grantRow = await page.locator("text=In-person sharing code").first().textContent();
const tokenPrefix = grantRow.match(/\(([0-9a-f]{8})\)/)[1];
assert("6 The code is a bare link with no health data in it",
  Boolean(handoffUrl) && /\/handoff\/[0-9a-f-]{36}$/.test(handoffUrl) && handoffUrl.includes(tokenPrefix) && !/breast|cancer|NCT|maria/i.test(handoffUrl), handoffUrl);

const scanner = await context.newPage();
await scanner.goto(handoffUrl, { waitUntil: "networkidle" });
assert("7 Shared profile opens as collapsed sections", (await scanner.locator("details[open]").count()) === 0);
await scanner.locator("summary", { hasText: "Medical History" }).click();
let s = (await scanner.locator("body").innerText()).replace(/\s+/g, " ");
assert("7 Shared profile is marked patient-authorized", s.includes("Patient-authorized view"));
assert("7 Shared profile shows only chosen sections", s.includes("Medical History") && !s.includes("Preferences"));
assert("7 Unknown facts read as unknown", s.includes("I don't know"));
assert("7 Contact details are withheld and said to be", s.includes("Contact details were not shared") && !s.includes("example.com"));
assert("7 No participant navigation or other people leak into the scanned view",
  (await scanner.locator("nav").count()) === 0 && !(await scanner.content()).includes("Dee Okafor"));
await shot("shared-profile", scanner);

await page.locator('button:has-text("Revoke")').first().click();
await page.waitForSelector("text=Revoked");
await scanner.goto(handoffUrl, { waitUntil: "networkidle" });
s = await scanner.content();
assert("7 A revoked code stops resolving and leaks nothing", s.includes("This code is not active") && !s.includes("Maria"));
await scanner.close();

/* Revoking the inquiry grant removes it from the team. */
await go("/passport");
await page.locator('button:has-text("Revoke")').first().click();
await page.waitForLoadState("networkidle");
await go("/coordinator");
assert("11 Revoking access empties the research team inbox", (await page.locator('#main a[href^="/coordinator/"]').count()) === 0);

await go("/access-gaps");
assert("Gaps are reported with denominators and not as discrimination", /\d+ \/ \d+/.test(await text()) && (await text()).includes("not evidence that a site turns anyone away"));
await shot("access-gaps");

/* Accessibility across screens */
for (const path of ["/", "/explore", "/trial/TP-FIX-001", "/trial/TP-FIX-001/preview", "/questions", "/passport", "/inbox", "/profile", "/profile/edit", "/timeline", "/inquiry/new/TP-FIX-001"]) {
  await go(path);
  const a11y = await page.evaluate(() => {
    const controls = [...document.querySelectorAll("button, a, input, select, textarea")];
    const small = controls.filter((el) => {
      if (el.closest("summary") || el.classList.contains("sr-only") || el.type === "hidden") return false;
      if (el.tagName === "A" && el.closest("p, li > span, dd")) return false;
      const rect = (el.closest("label") ?? el).getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.height < 40;
    }).map((el) => (el.textContent || el.name || el.tagName).trim().slice(0, 30));
    const unlabelled = [...document.querySelectorAll("input, select, textarea")].filter((el) =>
      el.type !== "hidden" && !el.getAttribute("aria-label") && !el.closest("label") && !document.querySelector(`label[for="${el.id}"]`)).length;
    return { h1: document.querySelectorAll("h1").length, small, unlabelled, dashes: /[\u2014\u2013]/.test(document.querySelector("#main").innerText) };
  });
  assert(`a11y ${path}: one h1, labelled controls, 40px targets, no em-dashes`,
    a11y.h1 === 1 && a11y.unlabelled === 0 && a11y.small.length === 0 && !a11y.dashes,
    JSON.stringify(a11y));
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${"=".repeat(56)}\n${results.length - failed.length} passed, ${failed.length} failed`);
for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
console.log(`screenshots in ${SHOTS}/\n${"=".repeat(56)}`);
process.exit(failed.length ? 1 : 0);
