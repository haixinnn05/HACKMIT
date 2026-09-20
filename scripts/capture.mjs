/**
 * Captures the twelve screens at phone size, in a populated state, to
 * .capture/NN.png. Used for side-by-side review against the design board.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".capture";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const go = async (path) => { await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await page.waitForLoadState("networkidle", { timeout: 3500 }).catch(() => {}); };
const snap = (n, target = page) => target.screenshot({ path: `${OUT}/${String(n).padStart(2, "0")}.png` });

await page.request.post(`${BASE}/api/reset`);
await page.request.post(`${BASE}/api/persona`, { data: { id: "p-maria" } });

const ask = async (text) => {
  await go("/questions?add=1&trial=TP-FIX-001");
  await page.fill('textarea[name="text"]', text);
  await page.click('button:has-text("Save question")');
  await page.waitForURL(/\/questions/);
};

await go("/trial/TP-FIX-001");
await page.locator('button:has-text("Save Trial")').click();
await page.waitForSelector('a:has-text("Apply")');
await go("/trial/TP-FIX-001?tab=eligibility");
for (const q of ["Is parking covered at the study site?", "Is travel assistance available?", "Can visits start early so I lose less work time?"]) await ask(q);

await go("/"); await snap(1);
await go("/explore"); await snap(2);
await go("/trial/TP-FIX-001"); await snap(3);
await go("/trial/TP-FIX-001/preview"); await snap(4);
await go("/inquiry/new/TP-FIX-001"); await snap(8);

await page.click('button:has-text("Send application")');
await page.waitForURL(/\/inquiry\/[0-9a-f-]{36}/);
const inquiryUrl = page.url();

await ask("Can my family member come with me to visits?");
await ask("What happens after the study ends?");

await go("/clinic/inbox");
await page.locator('#main a[href^="/clinic/inbox/"]').first().click();
await page.waitForURL(/\/clinic\/inbox\/[0-9a-f-]{36}/);
await page.waitForLoadState("networkidle");
await snap(11);
for (const key of ["parking", "travel assistance"]) {
  const item = page.locator("li", { hasText: new RegExp(key, "i") }).filter({ has: page.locator("textarea") }).first();
  await item.locator('button:has-text("Send this answer")').click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

await go("/questions"); await snap(5);
await go("/inbox"); await snap(9);
await go("/profile"); await snap(10);

await page.goto(inquiryUrl, { waitUntil: "domcontentloaded" });
await page.click('button:has-text("I have agreed to take part")');
await page.waitForURL(/\/timeline/);
await page.waitForLoadState("networkidle");
await snap(12);

await go("/passport");
await page.click('button:has-text("Share QR Code")');
await page.waitForSelector("text=Choose what to share");
for (const label of ["Travel preferences", "Saved questions"]) await page.locator('[role="dialog"] label', { hasText: label }).click();
const [response] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith("/api/handoff")),
  page.click('button:has-text("Create 10-minute code")'),
]);
const { url } = await response.json();
await page.waitForSelector("img[alt*='Scannable code']");
await page.evaluate(() => window.scrollTo(0, 0));
await snap(6);

const scanner = await context.newPage();
await scanner.goto(url, { waitUntil: "domcontentloaded" });
await snap(7, scanner);

await browser.close();
console.log("captured to", OUT);
