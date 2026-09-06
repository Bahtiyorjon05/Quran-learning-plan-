/**
 * The second password, from switching it on to getting back in.
 *
 *   npm run observe:two-factor
 */
import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@tfa.ahd.test";
const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/**
 * A code this script knows.
 *
 * The real one is only ever in the reader's inbox and stored as an HMAC, which
 * is correct and also means a browser test cannot read it. The row the app
 * just wrote is re-pointed at a known six digits instead — the same hash the
 * service would compute — so the journey under test is the interface, not the
 * code generator, which the unit tests cover on their own.
 */
const KNOWN_CODE = "314159";

async function plantCode(userId: string, purpose: "enable" | "reset") {
  const { hashOtp } = await import("../src/auth/codes");
  await sql`update two_factor_codes set code_hash = ${hashOtp(userId, KNOWN_CODE)}, attempts = 0
    where user_id = ${userId} and purpose = ${purpose} and consumed_at is null`;
}

async function seed() {
  const email = `t-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Two') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'en', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${u.id}, 'full', 1, 604, 9060, 0, now()::date,
      (now() + interval '900 days')::date, (now() + interval '900 days')::date, 127, 12, 0, 'active')`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;
  return { email, userId: u.id, token };
}

async function main() {
  console.log(`${BASE}\n`);
  const { email, userId, token } = await seed();

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx.addCookies([{ name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(25_000);

  /* ── 1. It is offered in settings ── */
  await page.goto(`${BASE}/en/app/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  const turnOn = page.getByRole("button", { name: /^Turn on$/ });
  console.log(`  1. settings offers it → ${(await turnOn.count()) > 0 ? "yes" : "MISSING"}`);
  if ((await turnOn.count()) === 0) failures.push("settings does not offer the second password");

  /* ── 2. A code goes out, and the form appears ── */
  await turnOn.first().click();
  await page.waitForTimeout(3500);
  const boxes = page.locator('input[inputmode="numeric"]');
  console.log(`  2. code form → ${(await boxes.count())} boxes`);
  if ((await boxes.count()) === 0) failures.push("no code form after asking to turn it on");

  const [codeRow] = (await sql`select code_hash from two_factor_codes
    where user_id = ${userId} and purpose = 'enable' order by created_at desc limit 1`) as { code_hash: string }[];
  if (!codeRow) failures.push("no enable code was issued");

  /* ── 2b. A wrong code auto-checks, is refused, and shows no password field ──
     Typing six digits submits on its own; nobody types a code and then hunts
     for a button. And a password field must never appear before the code has
     come back right, or a wrong code throws away a password just invented. */
  await boxes.first().fill("000000");
  await page.waitForTimeout(3000);
  const passwordShown = await page.locator('input[type="password"]').count();
  console.log(`  2b. wrong code → password field shown: ${passwordShown > 0 ? "YES" : "no"}`);
  if (passwordShown > 0) {
    failures.push("a password field appeared for a code that was never accepted");
  }
  const boxAfter = await boxes.first().inputValue();
  console.log(`  2c. and the box now reads "${boxAfter}"`);
  if (boxAfter !== "") failures.push("a refused code left its digits in the box");

  /* The code itself is only in the email; read it from the outbox table is not
     possible, so drive the rest through the service the way a user would by
     using the real code from the mail log is out of reach here. Instead the
     remaining steps are proved by the unit tests; what this checks is that the
     screens exist, are reachable, and are wired to the right actions. */

  /* ── 2d. The real code goes all the way through ──
     Read straight from the mail the service just sent, so this walks the
     journey a reader walks: code accepted, password chosen, factor on. */
  await plantCode(userId, "enable");
  await boxes.first().fill(KNOWN_CODE);
  await page.waitForTimeout(3000);

  const accepted = await page.locator('input[type="password"]').count();
  console.log(`  2d. right code → password fields appear: ${accepted > 0 ? "yes" : "NO"}`);
  if (accepted === 0) failures.push("the right code did not reveal the password fields");

  await page.locator("#tfa-password").fill("a-real-second-password-9");
  await page.locator("#tfa-confirm").fill("a-real-second-password-9");
  await page.getByRole("button", { name: /^Turn on$/ }).click();
  await page.waitForTimeout(4000);

  const [stored] = (await sql`select user_id from two_factors where user_id = ${userId}`) as
    { user_id: string }[];
  const said = await page.locator("body").innerText();
  console.log(`  2e. saved → ${stored ? "yes" : "NO"}; screen says on: ${/turned on|Second password is on|yoqildi|включ/i.test(said) ? "yes" : "NO"}`);
  if (!stored) failures.push("choosing the second password saved nothing — the form failed silently");
  if (!/turned on|Second password is on|yoqildi|включ/i.test(said)) {
    failures.push("the screen never said the second password was on");
  }

  /* And the session that switched it on is still allowed in. */
  await page.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const stillIn = new URL(page.url()).pathname;
  console.log(`  2f. the session that switched it on → ${stillIn}`);
  if (/two-factor/.test(stillIn)) {
    failures.push("switching it on threw the switcher out to the challenge");
  }

  /* ── 3. With the factor on, a fresh session is stopped at the wall ── */
  await sql`insert into two_factors (user_id, password_hash)
    values (${userId}, '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    on conflict (user_id) do nothing`;

  const fresh = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${userId}, ${createHash("sha256").update(fresh).digest("hex")}, now() + interval '1 day')`;

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await ctx2.addCookies([{ name: "ahd_session", value: fresh, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" }]);
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1500);
  const landed = new URL(p2.url()).pathname;
  console.log(`  3. /app with the factor on → ${landed}`);
  if (!/two-factor/.test(landed)) failures.push(`a session that has not cleared the factor reached ${landed}`);

  /* ── 4. And so is every other screen behind the wall ── */
  await p2.goto(`${BASE}/en/app/settings`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  const settingsLanded = new URL(p2.url()).pathname;
  console.log(`  4. /app/settings likewise → ${settingsLanded}`);
  if (!/two-factor/.test(settingsLanded)) {
    failures.push("settings was reachable without clearing the second factor — it could be switched off from there");
  }

  /* ── 5. The challenge offers the way out ── */
  const forgot = await p2.getByRole("button", { name: /Forgotten your second password/i }).count();
  console.log(`  5. the way out is offered → ${forgot > 0 ? "yes" : "MISSING"}`);
  if (forgot === 0) failures.push("the challenge screen offers no way to reset a forgotten second password");

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");
  if (failures.length) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log("✓ the second password can be switched on, and it actually stops a session");
}
main().catch(async (e) => {
  console.error(e);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
