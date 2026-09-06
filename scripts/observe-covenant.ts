/**
 * The ahd, readable — and settings that save themselves.
 *
 *   npm run observe:covenant
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@covenant.ahd.test";
const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);
  const email = `c-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Before') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'en', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status, niyyah)
    values (${u.id}, 'full', 1, 604, 9060, 0, (now() - interval '30 days')::date,
      (now() + interval '900 days')::date, (now() + interval '900 days')::date, 127, 12, 0, 'active',
      'For the sake of Allah.')`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.addCookies([{ name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(25_000);

  /* ── 1. The covenant reads back as a document ── */
  await page.goto(`${BASE}/en/app/plan`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  const text = (await page.locator("article").innerText()).replace(/\s+/g, " ");
  console.log(`  1. the ahd reads → ${text.slice(0, 96)}…`);
  for (const [what, re] of [
    ["the promise in a sentence", /undertook to memorise/i],
    ["the scope", /whole Qur/i],
    ["the intention", /For the sake of Allah/i],
    ["the deadline", /Deadline/i],
    ["the one rule", /only come closer/i],
  ] as const) {
    if (!re.test(text)) failures.push(`the covenant page does not show ${what}`);
  }

  /* ── 2. Settings save themselves ── */
  await page.goto(`${BASE}/en/app/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);

  const saveButton = await page.getByRole("button", { name: /^Save$/ }).count();
  console.log(`  2. a Save button → ${saveButton === 0 ? "gone" : "STILL THERE"}`);
  if (saveButton > 0) failures.push("settings still has a Save button");

  /* A decision: written the moment it is made. */
  await page.selectOption("#reciter", "husary");
  await page.waitForTimeout(2500);
  const [afterSelect] = (await sql`select preferred_reciter from profiles where user_id = ${u.id}`) as
    { preferred_reciter: string }[];
  console.log(`  3. changed the reciter → stored "${afterSelect.preferred_reciter}"`);
  if (afterSelect.preferred_reciter !== "husary") {
    failures.push("changing a select did not save on its own");
  }

  /* Typing: written once it stops. */
  await page.fill("#displayName", "After");
  await page.waitForTimeout(2500);
  const [afterName] = (await sql`select display_name from users where id = ${u.id}`) as
    { display_name: string }[];
  console.log(`  4. typed a name → stored "${afterName.display_name}"`);
  if (afterName.display_name !== "After") failures.push("typing a name did not save on its own");

  const told = await page.locator("body").innerText();
  console.log(`  5. the form said so → ${/Saved|Saqlandi|Сохранено/i.test(told) ? "yes" : "NO"}`);

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("✓ the ahd reads back in full, and settings save themselves");
}
main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
