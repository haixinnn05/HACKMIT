/**
 * Control audit: every button and link on every screen must be reachable.
 *
 * For each screen, in a populated state, every interactive element is checked
 * to be enabled, large enough to hit, and not covered by another element at its
 * centre (the usual cause of a "dead" button). Every internal link target is
 * then requested to confirm it resolves. Elements that look like controls but
 * are not are reported too.
 *
 * Usage: npm run dev, then `npm run audit`
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 14 Pro"] });
const page = await context.newPage();
const go = (path) => page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

// Populate: saved trial, questions, a shared and answered inquiry, a decision.
await page.request.post(`${BASE}/api/reset`);
await page.request.post(`${BASE}/api/persona`, { data: { id: "p-maria" } });
await go("/trial/TP-FIX-001");
await page.locator('button:has-text("Save Trial")').click();
await page.waitForSelector('a:has-text("Prepare an inquiry")');
await go("/questions?add=1&trial=TP-FIX-001");
await page.fill('textarea[name="text"]', "Is parking covered at the study site?");
await page.click('button:has-text("Save question")');
await page.waitForURL(/\/questions/);
await go("/inquiry/new/TP-FIX-001");
await page.click('button:has-text("Share Inquiry")');
await page.waitForURL(/\/inquiry\/[0-9a-f-]{36}/);
const inquiryPath = new URL(page.url()).pathname;
await go("/clinic/inbox");
const coordinatorPath = await page.locator('#main a[href^="/clinic/inbox/"]').first().getAttribute("href");
await go(coordinatorPath);
await page.locator('button:has-text("Send this answer")').first().click();
await page.waitForSelector("text=Sent by R. Alvarez");
await go(inquiryPath);
await page.click('button:has-text("I have agreed to take part")');
await page.waitForURL(/\/timeline/);

const screens = [
  "/", "/explore", "/trial/TP-FIX-001", "/trial/TP-FIX-001?tab=eligibility", "/trial/TP-FIX-001?tab=expect", "/trial/TP-FIX-001?tab=insight",
  "/trial/TP-FIX-001/preview", "/trial/NCT06185205", "/questions", "/questions?add=1", "/passport",
  "/inquiry/new/TP-FIX-001", "/inbox", inquiryPath, "/profile", "/profile/edit", "/profile/saved",
  "/clinic", "/clinic/inbox", coordinatorPath, "/clinic/patients", "/clinic/scan", "/clinic/studies", "/clinic/activity", "/welcome", "/apply/TP-FIX-001", "/peers", "/peers/settings", "/timeline", "/timeline?view=calendar", "/about", "/access-gaps",
];

const problems = [];
const links = new Set();
let total = 0;

for (const path of screens) {
  await go(path);
  // Open every disclosure so controls inside are audited too.
  await page.evaluate(() => document.querySelectorAll("details").forEach((d) => { d.open = true; }));

  const found = await page.evaluate(async () => {
    const out = [];
    const controls = [...document.querySelectorAll("a[href], button, summary, select, input:not([type=hidden]), textarea, [role=button], [role=checkbox]")];
    for (const el of controls) {
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 48);
      if (el.classList.contains("sr-only") && el.tagName === "A") continue; // skip link, sized on focus
      el.scrollIntoView({ block: "center", inline: "center" });
      await new Promise((r) => requestAnimationFrame(r));
      const rect = el.getBoundingClientRect();
      const item = { tag: el.tagName, name, href: el.getAttribute("href"), issue: null };
      const hidden = rect.width === 0 || rect.height === 0;
      // A visually hidden input is operated through its label; test the label.
      const target = hidden && el.closest("label") ? el.closest("label") : el;
      const box = target.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) item.issue = "has no size";
      else if (el.disabled) item.issue = "is disabled";
      else {
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (!hit || !(target.contains(hit) || hit.contains(target) || hit.closest("label") === target)) {
          item.issue = `is covered by <${hit?.tagName.toLowerCase()} class="${(hit?.className || "").toString().slice(0, 40)}">`;
        }
      }
      out.push(item);
    }
    // Things styled like a chip or button that are not controls.
    const fakes = [...document.querySelectorAll("span, div, p")].filter((el) => {
      const cls = el.className?.toString() ?? "";
      return /min-h-10|min-h-11|min-h-12/.test(cls) && /rounded-full/.test(cls) && !el.closest("a, button, label, summary") && !el.querySelector("a, button, input, select");
    }).map((el) => el.textContent.trim().slice(0, 40));
    return { out, fakes };
  });

  for (const item of found.out) {
    total += 1;
    if (item.issue) problems.push(`${path}  ${item.tag} "${item.name}" ${item.issue}`);
    if (item.tag === "A" && item.href?.startsWith("/")) links.add(item.href);
  }
  for (const fake of found.fakes) problems.push(`${path}  looks like a control but is not: "${fake}"`);
}

let broken = 0;
for (const href of links) {
  const response = await page.request.get(`${BASE}${href}`, { maxRedirects: 5 });
  if (response.status() >= 400) { broken += 1; problems.push(`link ${href} returns ${response.status()}`); }
}

await browser.close();
console.log(`\naudited ${total} controls on ${screens.length} screens, ${links.size} distinct internal links (${broken} broken)`);
if (problems.length) { console.log(`\n${problems.length} problems:`); for (const p of problems) console.log("  - " + p); }
else console.log("every control is reachable and every link resolves");
process.exit(problems.length ? 1 : 0);
