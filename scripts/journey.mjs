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
// Pages stream their AI sections, which holds the connection open. So wait for
// the document, then give hydration a moment, without requiring the network to go quiet.
const settle = async (target) => { await target.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {}); };
const go = async (path) => { await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await settle(page); };
const asRole = async (role) => { await page.request.post(`${BASE}/api/role`, { data: { role } }); };
const main = () => page.locator("#main");
const text = async () => (await main().innerText()).replace(/\s+/g, " ");

console.log("\nMozaic: twelve-screen journey\n");
await page.request.post(`${BASE}/api/reset`);
await page.request.post(`${BASE}/api/persona`, { data: { id: "p-maria" } });

/* 0. The front door */
const fresh = await browser.newContext({ viewport: { width: 430, height: 932 } });
const door = await fresh.newPage();
await door.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
assert("0 A first-time visitor is asked to log in as a patient or clinic", door.url().endsWith("/login") && (await door.locator("#main").innerText()).includes("Clinic / researcher"));
await door.click('button:has-text("Clinic / researcher")');
await door.waitForURL(/\/clinic$/);
assert("0 Choosing the research team opens a separate app with its own navigation",
  (await door.locator('nav[aria-label="Research team"]').count()) === 1 && (await door.locator('nav[aria-label="Main"]').count()) === 0);
await fresh.close();

await page.request.post(`${BASE}/api/role`, { data: { role: "participant" } });

/* 1. Home */
await go("/");
let t = await text();
assert("1 Home greets the participant by name", /Good (morning|afternoon|evening), Maria/.test(t));
assert("1 Home starts with finding a trial when none is underway", t.includes("Find a trial"));
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
assert("3 Detail has four tabs, Insight among them", ["Overview", "Eligibility", "What to Expect", "Insight"].every((label) => t.includes(label)));
await go(`${realHref}?tab=insight`);
await page.waitForSelector("text=From OpenAlex", { timeout: 25000 }).catch(() => {});
t = await text();
assert("3 Insight explains the research area in OpenAlex's own words", t.includes("The research area:") && t.includes("Quoted from OpenAlex"));
assert("3 Insight is labelled as background, not a requirement", t.includes("This is background, not a requirement") && t.includes("says nothing about whether you could take part"));
assert("3 Insight states that no passport data reaches OpenAlex", t.includes("never sent to OpenAlex"));
await go(realHref);
t = await text();
await page.fill('input[name="ask"]', "What is the wifi password?");
await page.click('button:has-text("Ask")');
await page.waitForURL(/ask=/);
// The answer streams in, and may come from a model or from keyword search.
await page.waitForSelector("text=Keep in mind:", { timeout: 90000 });
t = await text();
assert("3 Asking something the record does not cover gets an honest no",
  /record does not say|not stated in the material/.test(t) && t.includes("Save this question for the study team"));
assert("3 The answer says how it was found", /No language model was involved|Answered with a language model, and the quote was checked/.test(t));
await shot("detail-real");
await go(`${realHref}?tab=expect`);
assert("3 A real record refuses to estimate a time commitment", (await text()).includes("time commitment is not published"));

await go("/trial/TP-FIX-001");
assert("3 The fictional study is labelled fictional", (await text()).includes("Fictional study"));
await page.locator('button:has-text("Save Trial")').click();
await page.waitForSelector('a:has-text("Apply")');
assert("3 Saving swaps the primary action to applying", true);
await go("/trial/TP-FIX-001?ask=" + encodeURIComponent("Do I get paid for taking part?"));
await page.waitForSelector("text=Keep in mind:", { timeout: 90000 });
const quoted = ((await page.locator("#ask blockquote").first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const fixtureText = "Participants receive $50 per completed on-site visit. Payment accrues per visit and does not depend on completing the entire study.";
assert("3 Asking something the record covers quotes it word for word", quoted.length > 12 && fixtureText.includes(quoted), quoted);
await shot("detail-ask");
await go("/trial/TP-FIX-001?tab=insight");
await page.waitForSelector("text=OpenAlex,", { timeout: 25000 }).catch(() => {});
t = await text();
assert("3 Insight is available on the demo study too, with abstracts quoted", t.includes("The research area:") && t.includes("From the abstract"));
await shot("detail-insight");
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
await settle(page);
await go("/questions?add=1&trial=TP-FIX-001");
await page.fill('textarea[name="text"]', "Can my family member come with me to visits?");
await page.click('button:has-text("Save question")');
await page.waitForURL(/\/questions/);
await go("/questions");
t = await text();
assert("5 Questions are saved and counted", t.includes("All (2)") && t.includes("Need to ask (2)"));
await shot("questions");

/* 8. Application form */
await go("/apply/TP-FIX-001");
t = await text();
assert("8 The passport sits on the form, unfilled until tapped", t.includes("Use this passport") && (await page.locator('input[name="f_name"]').inputValue()) === "");
await page.click('button:has-text("Use this passport")');
await page.waitForSelector("text=From your passport");
t = await text();
assert("8 The application form is filled from the passport", /\d+ of \d+ answers filled from your passport/.test(t));
assert("8 Each answer shows where it came from", t.includes("From your passport") && t.includes("You marked this unknown") && t.includes("Only you can answer"));
assert("8 A fact marked unknown is left blank, not guessed", (await page.locator('input[name="f_her2"]').inputValue()) === "");
assert("8 Known facts are prefilled", (await page.locator('input[name="f_stage"]').inputValue()) === "Stage II" && (await page.locator('input[name="f_name"]').inputValue()) === "Maria Restrepo");
assert("8 Contact details start unticked", !(await page.locator('input[name="includeContact"]').isChecked()));
await page.fill('input[name="f_oncologist"]', "Dr. Patel, Lowell General");
await page.fill('input[name="f_her2"]', "negative");
await shot("inquiry-review");
await page.click('button:has-text("Send application")');
await page.waitForURL(/\/inquiry\/[0-9a-f-]{36}/, { timeout: 20000 });
const inquiryUrl = page.url();
assert("8 Sharing is not presented as enrolment", (await text()).includes("Shared, waiting to be picked up"));
await go("/");
assert("1 Home waits for the clinic before checking approval", (await text()).includes("Waiting for approval") && (await text()).includes(", up next"));

/* 11. Research Team Inbox */
await asRole("clinic");
await go("/clinic/inbox");
t = await text();
const items = page.locator('#main a[href^="/clinic/inbox/"]');
assert("11 The inquiry reaches the research team", (await items.count()) === 1 && t.includes("Maria Restrepo"));
await shot("team-inbox");
await items.first().click();
await page.waitForURL(/\/clinic\/inbox\/[0-9a-f-]{36}/);
await settle(page);
t = await text();
assert("11 Considerations group as Supported, Unknown, Needs review", ["Supported", "Unknown", "Needs review"].every((l) => t.includes(l)));
assert("11 Unshared contact details are absent and explained", !t.includes("maria.demo@example.com") && t.includes("Contact details not shared"));
assert("11 The coordinator sees the application answers with their origin", t.includes("Application answers") && t.includes("Dr. Patel, Lowell General") && t.includes("typed on the form") && t.includes("from passport"));
assert("11 Missing information is listed to request", t.includes("Missing information to request"));
assert("11 A Reply action stays in reach", (await page.locator('a:has-text("Reply to Maria")').count()) === 1);
await shot("team-review");
const parking = () => page.locator("li", { hasText: "Is parking covered" });
assert("11 A saved site answer is pre-filled", (await parking().locator('textarea[name="answer"]').inputValue()).includes("Harborview"));
await parking().locator('select[name="assignee"]').selectOption("finance");
await parking().locator('button:has-text("Assign")').click();
await page.waitForSelector("text=Owner: Site finance office");
assert("11 A question can be assigned an owner", (await parking().innerText()).includes("Assigned"));

await parking().locator('button:has-text("Save draft")').click();
await page.waitForSelector("text=Saved draft");
assert("11 A draft is saved with its own state", (await parking().innerText()).includes("Draft answer"));
const peek = await context.newPage();
await asRole("participant");
await peek.goto(inquiryUrl, { waitUntil: "domcontentloaded" });
assert("11 A draft is never visible to the participant", !(await peek.locator("#main").innerText()).includes("validated at the Harborview garage"));
await peek.close();

await asRole("clinic");
await parking().locator('button:has-text("Send this answer")').click();
await page.waitForSelector("text=Sent by R. Alvarez", { timeout: 20000 });
assert("11 The reply is attributed to the person who sent it", true);

/* 9. Inbox */
await asRole("participant");
await go("/inbox");
t = await text();
assert("9 Inbox shows the reply as unread", t.includes("Unread (1)") && t.includes("Answered"));
await shot("inbox");
await go("/");
assert("1 Home waits for clinic approval after a reply", (await text()).includes("Waiting for approval") && (await text()).includes("up next"));
await page.goto(inquiryUrl, { waitUntil: "domcontentloaded" });
t = await text();
assert("9 The thread shows the full answer and its author", t.includes("validated at the Harborview garage") && t.includes("R. Alvarez"));
assert("9 Choices include asking for help or declining",
  ["Please help me contact the study team", "I am not interested"].every((l) => t.includes(l)));
await shot("thread");
await page.click('button:has-text("I still have a question")');
await page.waitForSelector("text=Reopened");
assert("9 The participant can reopen an answered question", true);
await asRole("clinic");
await go("/clinic/inbox");
await page.locator('#main a[href^="/clinic/inbox/"]').first().click();
await page.waitForURL(/\/clinic\/inbox\/[0-9a-f-]{36}/);
await settle(page);
assert("11 The team sees it reopened, with the earlier answer kept as history",
  (await text()).includes("Reopened") && (await text()).includes("Earlier answer"));
await page.locator("li", { hasText: "Is parking covered" }).locator('button:has-text("Send this answer")').click();
await page.waitForSelector("text=Sent by R. Alvarez", { timeout: 20000 });
await asRole("participant");
await page.goto(inquiryUrl, { waitUntil: "domcontentloaded" });
await page.click('button:has-text("This answers it")');
await page.waitForSelector("text=You marked this resolved");
assert("9 The participant can mark an answer resolved", true);
await go("/inbox");
assert("9 Opening the thread marks it read", (await text()).includes("Unread (0)"));
await go("/questions?tab=answered");
assert("5 The answered question moves to Answered", (await text()).includes("Answered (1)"));

/* 12. Visits & Timeline */
await asRole("clinic");
await go("/clinic/inbox");
await page.locator('#main a[href^="/clinic/inbox/"]').first().click();
await page.waitForURL(/\/clinic\/inbox\/[0-9a-f-]{36}/);
await settle(page);
await page.click('button:has-text("Approve for this study")');
await page.waitForSelector("text=Approved for this study");
await asRole("participant");
await go("/timeline");
t = await text();
assert("12 Clinic approval leads to a timeline of confirmed visits", ["Screening visit", "Baseline visit", "Month 3 follow-up", "Month 6 follow-up"].every((l) => t.includes(l)));
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
assert("1 Home keeps a path for the study being taken", (await text()).includes("Harborview"));
assert("1 Home marks waiting for approval as done after clinic approval", (await text()).includes("Waiting for approval") && (await text()).includes(", done"));
await page.click('button:has-text("Get ready")');
await page.waitForSelector('[role="dialog"]');
assert("1 A journey stop opens its own card", (await text()).includes("Confirm parking details") && (await text()).includes("Full timeline"));
const openTodo = page.locator('[role="dialog"] button[role="checkbox"][aria-checked="false"]').first();
const openLabel = (await openTodo.innerText()).trim();
await openTodo.click();
await page.waitForSelector(`[role="dialog"] button[role="checkbox"][aria-checked="true"]:has-text("${openLabel}")`);
await page.click('button:has-text("Full timeline")');
await page.waitForURL(/\/timeline\?view=timeline/, { timeout: 10000 });
assert("1 Full timeline opens the visit list", (await text()).includes("Screening visit") && (await page.locator(`button[role="checkbox"][aria-checked="true"]:has-text("${openLabel}")`).count()) >= 1 && !(await page.url()).includes("view=calendar"));
await go("/");
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
await scanner.goto(handoffUrl, { waitUntil: "domcontentloaded" });
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

/* 13. Research team: open the passport by its pass number */
const staff = await context.newPage();
const staffText = async () => (await staff.locator("#main").innerText()).replace(/\s+/g, " ");
await asRole("clinic");
await staff.goto(`${BASE}/clinic/scan`, { waitUntil: "domcontentloaded" });
await staff.fill('input[name="pass"]', "00000000");
await staff.click('button:has-text("Open passport")');
await staff.waitForURL(/missed=1/);
assert("13 A wrong pass number reveals nothing", (await staffText()).includes("No active passport matches"));
await staff.fill('input[name="pass"]', tokenPrefix);
await staff.click('button:has-text("Open passport")');
await staff.waitForURL(/\/handoff\//);
assert("13 The right pass number opens the shared profile, with a way back", (await staffText()).includes("Shared Patient Profile") && (await staffText()).includes("Back to your workspace"));
await shot("clinic-scan-result", staff);

await page.locator('button:has-text("Revoke")').first().click();
await page.waitForSelector("text=In-person sharing code", { state: "detached" });
await staff.goto(`${BASE}/clinic/scan`, { waitUntil: "domcontentloaded" });
await staff.fill('input[name="pass"]', tokenPrefix);
await staff.click('button:has-text("Open passport")');
await staff.waitForURL(/missed=1/);
assert("13 A revoked pass number fails exactly like a wrong one", (await staffText()).includes("No matching passport"));

/* 14. Research team: Today, Patients, Studies, Activity */
await staff.goto(`${BASE}/clinic`, { waitUntil: "domcontentloaded" });
let st = await staffText();
assert("14 Today counts what is waiting", ["Need review", "Open questions", "Waiting on patient", "Visits this week"].every((l) => st.includes(l)));
assert("14 Today links to the activity log", st.includes("Activity log"));
await shot("clinic-today", staff);

await staff.goto(`${BASE}/clinic/patients`, { waitUntil: "domcontentloaded" });
st = await staffText();
assert("14 Patients lists who is sharing, and has no patient search", st.includes("Maria Restrepo") && (await staff.locator('#main input[type="search"]').count()) === 0);
await staff.click('#main a[href^="/clinic/patients/"]');
await staff.waitForURL(/\/clinic\/patients\/p-/);
const patientUrl = staff.url();
st = await staffText();
assert("14 A patient page shows what they shared, unknowns included", st.includes("Shared information") && st.includes("I don't know"));
assert("14 A patient page withholds unshared contact details", !st.includes("example.com") && st.includes("Contact details were not shared"));
assert("14 A patient's upcoming visits are visible to the site", st.includes("Upcoming visits") && st.includes("Screening visit"));
await shot("clinic-patient", staff);

await staff.goto(`${BASE}/clinic/studies`, { waitUntil: "domcontentloaded" });
await staff.fill('input[name="keywords"]', "family, caregiver");
await staff.fill('textarea[name="answer"]', "A family member is welcome at every visit, and there is a waiting area beside the clinic.");
await staff.click('button:has-text("Save reply")');
await staff.waitForSelector("text=A family member is welcome");
assert("14 A new saved reply joins the library", (await staffText()).includes("Saved replies (4)"));
await shot("clinic-studies", staff);
await staff.goto(`${BASE}/clinic/inbox`, { waitUntil: "domcontentloaded" });
await staff.click('#main a[href^="/clinic/inbox/"]');
await staff.waitForURL(/\/clinic\/inbox\/[0-9a-f-]{36}/);
await settle(staff);
assert("14 The saved reply is offered as a draft on a matching question",
  (await staff.locator("li", { hasText: "Can my family member" }).locator("textarea").inputValue()).includes("A family member is welcome"));

await staff.goto(`${BASE}/clinic/activity`, { waitUntil: "domcontentloaded" });
st = await staffText();
assert("14 The activity log records access and replies without private text",
  st.includes("In-person passport opened") && st.includes("Answer sent") && !st.includes("validated at the Harborview garage"));

await scanner.goto(handoffUrl, { waitUntil: "domcontentloaded" });
s = await scanner.content();
assert("7 A revoked code stops resolving and leaks nothing", s.includes("This code is not active") && !s.includes("Maria"));
await scanner.close();

/* Revoking the inquiry grant removes it from the team. */
await asRole("participant");
await go("/passport");
await page.locator('button:has-text("Revoke")').first().click();
await settle(page);
await asRole("clinic");
await go("/clinic/inbox");
assert("11 Revoking access empties the research team inbox", (await page.locator('#main a[href^="/clinic/inbox/"]').count()) === 0);
await staff.goto(`${BASE}/clinic/patients`, { waitUntil: "domcontentloaded" });
assert("14 After revoking, the person leaves the Patients list", !(await staffText()).includes("Maria Restrepo"));
await staff.goto(patientUrl, { waitUntil: "domcontentloaded" });
assert("14 A kept link to a revoked patient shows nothing", (await staffText()).includes("not sharing anything with your site") && !(await staffText()).includes("Stage II"));
await staff.close();

await asRole("participant");
await go("/access-gaps");
assert("Gaps are reported with denominators and not as discrimination", /\d+ \/ \d+/.test(await text()) && (await text()).includes("not evidence that a site turns anyone away"));
await shot("access-gaps");

/* 15. New answers from the inquiry are saved back to the passport */
await go("/profile/edit");
assert("15 A new answer is saved back to the passport for next time", (await page.locator('input[name="fact_her2"]').inputValue()) === "negative");

/* 16. Talking with a peer */
await asRole("participant");
await go("/peers");
assert("16 Peer matching is off until the person turns it on", (await text()).includes("This is off until you turn it on"));
await go("/peers?trial=TP-FIX-001");
await go("/peers/settings");
for (const id of ["stage", "biomarkers", "treatment", "age", "practical"]) await page.check(`input[value="${id}"]`);
await page.click('button:has-text("Turn on matching")');
await page.waitForURL(/\/peers$/);
t = await text();
assert("16 Suggestions use an alias and explain what is in common", t.includes("Suggested for you") && /You both have breast cancer/.test(t));
assert("16 Suggestions never expose real names or contact details", !t.includes("Okafor") && !t.includes("example.com"));
assert("16 A different diagnosis is not suggested", !t.includes("lung"));
await shot("peers");
await go("/peers?trial=TP-FIX-001");
assert("16 Nobody is paired about a study they have joined", (await text()).includes("Not while you're taking part in this study"));

await go("/peers");
const peerAlias = (await page.locator("#main li p.font-bold").first().innerText()).trim();
await page.locator('input[name="note"]').first().fill("Hi, I would love to compare notes on the travel.");
await page.locator('button:has-text("Ask")').first().click();
await page.waitForURL(/\/peers\/[0-9a-f-]{36}/);
const peerUrl = page.url();
assert("16 A request waits for the other person to agree", (await text()).includes(`Waiting for ${peerAlias}`));

const otherId = { Dee: "p-dee", Rosa: "p-eval-06", Sam: "p-eval-07", Ivy: "p-eval-01", Noor: "p-eval-05" }[peerAlias];
await page.request.post(`${BASE}/api/persona`, { data: { id: otherId } });
await page.goto(peerUrl, { waitUntil: "domcontentloaded" });
t = await text();
assert("16 The other person sees the request under an alias, with the note", t.includes("would like to talk") && t.includes("compare notes on the travel") && !t.includes("Restrepo"));
await page.click('button:has-text("Yes, let")');
await page.waitForSelector("text=A few ground rules");
await page.waitForSelector("text=Not sure how to start?", { timeout: 90000 });
t = await text();
assert("16 Conversation starters are offered and labelled with their source", t.includes("Not sure how to start?") && /No language model was involved|Suggested by/.test(t));
await page.locator('#main a[href*="draft="]').first().click();
await page.waitForURL(/draft=/);
assert("16 A starter fills the box but is not sent", (await page.locator('textarea[name="text"]').inputValue()).length > 10 && (await page.locator("ol li").count()) === 0);
await page.click('button:has-text("Send")');
await page.waitForSelector("ol li");
assert("16 The box is empty again after sending, so a starter cannot be sent twice", (await page.locator('textarea[name="text"]').inputValue()) === "");
await page.fill('textarea[name="text"]', "Do you know which arm you were randomized to?");
await page.click('button:has-text("Send")');
await page.waitForSelector("text=best taken to the study team");
assert("16 A message about treatment groups gets a gentle reminder", true);
await shot("peer-chat");

const stranger = await browser.newContext();
const intruder = await stranger.newPage();
await intruder.request.post(`${BASE}/api/persona`, { data: { id: "p-harold" } });
const intrusion = await intruder.goto(peerUrl, { waitUntil: "domcontentloaded" });
assert("16 A third person cannot read the conversation", intrusion.status() === 404);
await stranger.close();

await page.request.post(`${BASE}/api/persona`, { data: { id: "p-maria" } });
await page.goto(peerUrl, { waitUntil: "domcontentloaded" });
assert("16 The first person sees the reply", (await page.locator("ol li").count()) === 2);
await page.click('button:has-text("End conversation")');
await page.waitForURL(/\/peers$/);
assert("16 Either person can end it", (await text()).includes("Ended"));

/* Accessibility across screens */
for (const path of ["/apply/TP-FIX-001", "/peers", "/peers/settings", "/", "/explore", "/trial/TP-FIX-001", "/trial/TP-FIX-001/preview", "/questions", "/passport", "/inbox", "/profile", "/profile/edit", "/timeline", "/inquiry/new/TP-FIX-001"]) {
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
