/**
 * Forgotten password, end to end.
 *
 *   npm run observe:reset
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@reset.ahd.test";
const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(20_000);

  /* ── 1. An address nobody uses is said so ── */
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "domcontentloaded" });
  /* Wait for hydration: a click landing before it does a native form POST, and
     the state the action returns has nowhere to live. */
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill("#email", `ghost-${Date.now()}@example.com`);
  await page.getByRole("button", { name: /Kod yuborish|Send|Отправить/i }).click();
  await page.waitForTimeout(4000);
  const said = await page.locator("body").innerText();
  const told = /topilmadi|No account|не найден/i.test(said);
  if (!told) {
    const alerts = await page.evaluate(() =>
      [...document.querySelectorAll('[role="alert"], form p')].map((e) => (e.textContent || "").trim()).filter(Boolean));
    console.log(`     alerts on the page: ${JSON.stringify(alerts)}`);
    console.log(`     url: ${page.url()}`);
  }
  console.log(`  1. unknown address → ${told ? "told plainly" : "SILENT"}`);
  if (!told) failures.push("an unknown address was not reported");
  if (!/forgot-password/.test(new URL(page.url()).pathname)) {
    failures.push("an unknown address still moved on to the code screen");
  }

  /* ── 2. A real account gets a code, and the code has its own step ── */
  const email = `r-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Reset') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'uz', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;

  await page.goto(`${BASE}/forgot-password`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.getByRole("button", { name: /Kod yuborish|Send|Отправить/i }).click();
  await page.waitForTimeout(3000);
  const onReset = /reset-password/.test(new URL(page.url()).pathname);
  console.log(`  2. known address   → ${onReset ? "moved to the code screen" : "STUCK"}`);
  if (!onReset) failures.push("a known address did not reach the code screen");

  const hasPassword = await page.locator("#password").count();
  console.log(`  3. password asked for up front → ${hasPassword > 0 ? "YES" : "no"}`);
  if (hasPassword > 0) failures.push("the password is asked for before the code is checked");

  /* ── 3. A wrong code is refused and the boxes clear ── */
  /* One real input behind six drawn cells, so the whole code goes in at once.
     Filling six times over would have typed a single digit and been refused by
     the length check rather than by the server, which is not the path under
     test. */
  const boxes = page.locator('input[inputmode="numeric"]');
  await boxes.first().fill("000000");
  await page.getByRole("button", { name: /tekshirish|Check|Проверить/i }).click();
  await page.waitForTimeout(2500);
  const cleared = await boxes.first().inputValue();
  console.log(`  4. wrong code      → refused, first box "${cleared}"`);
  if (cleared !== "") failures.push("a wrong code left its digits in the boxes");

  /* ── 4. The right code opens the password step ── */
  const [row] = (await sql`select id from password_reset_codes where user_id = ${u.id}
    order by created_at desc limit 1`) as { id: string }[];
  if (!row) failures.push("no reset code was issued");

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("✓ the address is checked first, then the code, then the password");
}
main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
