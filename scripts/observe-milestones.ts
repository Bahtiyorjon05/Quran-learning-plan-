/**
 * Finishing a juz, and being told so once.
 *
 *   npm run observe:milestones
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@milestone.ahd.test";
const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);
  const email = `m-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Milestone') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'en', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${u.id}, 'full', 1, 604, 9060, 0, now()::date,
      (now() + interval '900 days')::date, (now() + interval '900 days')::date, 127, 12, 0, 'active')`;

  /* Juz 30 is pages 582–604, all but the last one. */
  for (let page = 582; page <= 603; page++) {
    await sql`insert into memorization_units (user_id, page, state, strength, first_memorized_at, last_reviewed_at)
      values (${u.id}, ${page}, 'memorized', 60, now(), now())`;
  }

  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.addCookies([{ name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(25_000);

  /* ── 1. Twenty-two of twenty-three pages: nothing yet ── */
  await page.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const early = await page.locator('[role="dialog"]').count();
  console.log(`  1. juz not yet finished → celebration shown: ${early > 0 ? "YES" : "no"}`);
  if (early > 0) failures.push("a celebration fired for a juz that was not finished");

  const seals = await page.locator('ul[aria-label="0/30"]').count();
  console.log(`  2. seals on the dashboard → ${seals > 0 ? "0 of 30 lit" : "MISSING"}`);
  if (seals === 0) failures.push("the seals are not on the dashboard");

  /* ── 3. The last page of the juz ── */
  await page.goto(`${BASE}/en/app/quran/604`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  const toggles = page.locator("form button[aria-pressed]");
  const n = await toggles.count();
  for (let i = 0; i < n; i++) {
    await toggles.nth(i).click();
    await page.waitForTimeout(1800);
  }

  /* The last toggle's action is still in flight when the click returns, so the
     row is waited for rather than assumed. */
  let row: { juz: number; seen_at: string | null } | undefined;
  for (let i = 0; i < 10 && !row; i++) {
    [row] = (await sql`select juz, seen_at from juz_milestones where user_id = ${u.id}`) as
      { juz: number; seen_at: string | null }[];
    if (!row) await page.waitForTimeout(1000);
  }
  console.log(`  3. recorded → ${row ? `juz ${row.juz}, seen: ${row.seen_at ?? "not yet"}` : "NOTHING"}`);
  if (!row) failures.push("finishing a juz recorded no milestone");
  else if (row.juz !== 30) failures.push(`recorded juz ${row.juz}, expected 30`);

  /* ── 4. The dashboard owes the moment ── */
  await page.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const shown = await page.locator('[role="dialog"]').count();
  const text = shown > 0 ? await page.locator('[role="dialog"]').innerText() : "";
  console.log(`  4. celebration → ${shown > 0 ? text.replace(/\s+/g, " ").slice(0, 60) : "MISSING"}`);
  if (shown === 0) failures.push("finishing a juz showed no celebration");

  /* ── 5. And only once ── */
  await page.getByRole("button", { name: /Continue/i }).click();
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const again = await page.locator('[role="dialog"]').count();
  console.log(`  5. shown a second time → ${again > 0 ? "YES" : "no"}`);
  if (again > 0) failures.push("the celebration fires again on every visit");

  const lit = await page.locator('ul[aria-label="1/30"]').count();
  console.log(`  6. seals now → ${lit > 0 ? "1 of 30 lit" : "NOT UPDATED"}`);
  if (lit === 0) failures.push("the seal did not light after the juz was finished");

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("✓ a finished juz is recorded, celebrated once, and lights its seal");
}
main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
