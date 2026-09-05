/**
 * One surah of a shared page, without claiming its neighbours.
 *
 * Page 604 carries Al-Ikhlas, Al-Falaq and An-Nas. Marking it used to be one
 * switch, so somebody who had Al-Ikhlas by heart also claimed the other two.
 *
 *   npm run observe:surah-mark
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@surahmark.ahd.test";
const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);
  const email = `s-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Mark') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'uz', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${u.id}, 'full', 1, 604, 9060, 0, now()::date,
      (now() + interval '900 days')::date, (now() + interval '900 days')::date, 127, 12, 0, 'active')`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20_000);

  await page.goto(`${BASE}/app/quran/604`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]");
  await page.waitForTimeout(1500);

  const toggles = page.locator('form button[aria-pressed]');
  const n = await toggles.count();
  console.log(`  1. toggles on page 604 → ${n}`);
  if (n !== 3) failures.push(`page 604 offers ${n} toggles, expected one per surah (3)`);

  /* Mark only the first — Al-Ikhlas. */
  await toggles.first().click();
  await page.waitForTimeout(2500);

  const [row] = (await sql`
    select surahs, state from memorization_units where user_id = ${u.id} and page = 604
  `) as { surahs: number[] | null; state: string }[];
  console.log(`  2. stored → ${JSON.stringify(row?.surahs)} (${row?.state})`);
  if (!row) failures.push("marking one surah stored nothing");
  else if (row.surahs === null) failures.push("marking one surah claimed the whole page");
  else if (row.surahs.length !== 1) failures.push(`stored ${row.surahs.length} surahs, expected 1`);

  /* The surah list must show exactly one of the three as held. */
  await page.goto(`${BASE}/app/quran`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const held = await page.evaluate(() => {
    const marks = [...document.querySelectorAll("a")].filter((a) =>
      /\/quran\/(surah\/)?(11[124]|604)/.test(a.getAttribute("href") || ""));
    return marks.map((a) => ({
      href: a.getAttribute("href"),
      held: /YODLANGAN|MEMORISED|ВЫУЧЕНО/i.test(a.textContent || ""),
    }));
  });
  const heldCount = held.filter((h) => h.held).length;
  console.log(`  3. surahs shown as held among 112–114 → ${heldCount}`);
  if (heldCount !== 1) failures.push(`the list shows ${heldCount} of the three as held, expected 1`);

  /* And the page must not be counted as a whole page held. */
  const [count] = (await sql`
    select count(*)::int as n from memorization_units
    where user_id = ${u.id} and state = 'memorized' and surahs is null`) as { n: number }[];
  console.log(`  4. whole pages held → ${count.n}`);
  if (count.n !== 0) failures.push(`${count.n} whole pages counted from a part-page mark`);

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("✓ one surah of a shared page can be held on its own");
}
main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
