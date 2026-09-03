/**
 * Settings save, and a covenant only ever comes closer.
 *
 * The second half is the one that matters. The rule a covenant rests on is
 * that its deadline can be pulled in and never pushed out, and that it can be
 * done once — so this tries all three: a later date, a nearer one, and a
 * second amendment after the first. Refusals are checked in the database, not
 * in the interface, because the interface is not where the rule lives.
 *
 *   npm run observe:settings
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@settings.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** A date that many days from today, as "YYYY-MM-DD". */
function daysOut(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function setDeadline(page: Page, date: string) {
  await page.fill("#newEndDate", date);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Bring the deadline closer/i }).click();
  await page.waitForTimeout(2500);
}

async function main() {
  console.log(`${BASE}\n`);

  const email = `s-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Before') returning id
  `) as { id: string }[];
  await sql`
    insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${user.id}, 'en', now(), 'Asia/Tashkent', 'alafasy', '05:30')
  `;

  const ORIGINAL = daysOut(400);
  await sql`
    insert into plans (user_id, scope, total_lines, completed_lines,
                       start_date, original_end_date, current_end_date,
                       study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${user.id}, 'full', 9060, 400,
            (now() - interval '30 days')::date, ${ORIGINAL}::date, ${ORIGINAL}::date,
            127, 12, 0, 'active')
  `;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await context.addCookies([
    { name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  /* ── 1. Settings save ── */
  await page.goto(`${BASE}/en/app/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#displayName", { timeout: 20_000 });

  await page.fill("#displayName", "After");
  await page.selectOption("#reciter", "husary");
  await page.fill("#studyTime", "21:15");
  /* By name, not by type: the header carries a submit button of its own
     (logging out), and "the only submit on the page" was never true. */
  await page.getByRole("button", { name: /^Save$/ }).click();
  await page.waitForTimeout(2500);

  const [saved] = (await sql`
    select u.display_name, p.preferred_reciter, p.study_time::text as study_time
    from users u join profiles p on p.user_id = u.id where u.id = ${user.id}
  `) as Record<string, string>[];

  console.log(`  1. settings saved  → ${JSON.stringify(saved)}`);
  if (saved.display_name !== "After") failures.push("the name did not save");
  if (saved.preferred_reciter !== "husary") failures.push("the reciter did not save");
  if (!String(saved.study_time).startsWith("21:15")) failures.push("the study time did not save");

  /* ── 2. A later deadline is refused, in both places it could be ── */
  await page.goto(`${BASE}/en/app/plan/amend`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#newEndDate", { timeout: 20_000 });

  const later = daysOut(600);
  const max = await page.getAttribute("#newEndDate", "max");
  console.log(`  2. the field allows nothing after ${max}`);
  if (!max || max >= ORIGINAL) {
    failures.push(`the date field allows ${max}, which is not before the current deadline`);
  }

  await page.fill("#newEndDate", later);
  await page.waitForTimeout(400);
  const offered = await page
    .getByRole("button", { name: /Bring the deadline closer/i })
    .isEnabled();
  console.log(`  3. with a later date the button is ${offered ? "ENABLED" : "refused"}`);
  if (offered) failures.push("the form offers to save a deadline later than the current one");

  /* And the rule does not live in the form. Try it underneath. */
  let refused = false;
  try {
    await sql`
      update plans set current_end_date = ${later}::date
      where user_id = ${user.id} and status = 'active'
    `;
  } catch {
    refused = true;
  }

  const [afterLater] = (await sql`
    select current_end_date::text as d from plans where user_id = ${user.id}
  `) as { d: string }[];

  console.log(
    `  4. straight at the database → ${refused ? "refused" : "ACCEPTED"}, deadline is ${afterLater.d}`,
  );
  if (!refused || afterLater.d !== ORIGINAL) {
    failures.push(
      `the database let the deadline move out to ${afterLater.d} — a covenant must never be extended`,
    );
  }

  /* ── 3. A nearer one is taken ── */
  await page.goto(`${BASE}/en/app/plan/amend`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#newEndDate", { timeout: 20_000 });

  const nearer = daysOut(300);
  await setDeadline(page, nearer);

  const [afterNearer] = (await sql`
    select current_end_date::text as d from plans where user_id = ${user.id}
  `) as { d: string }[];
  const [logged] = (await sql`
    select count(*)::int as n from plan_amendments a
    join plans p on p.id = a.plan_id
    where p.user_id = ${user.id} and a.kind = 'shortened'
  `) as { n: number }[];

  console.log(`  4. nearer date     → deadline is ${afterNearer.d}, logged ${logged.n} time(s)`);
  if (afterNearer.d !== nearer) failures.push(`the deadline did not move to ${nearer}`);
  if (logged.n !== 1) failures.push(`the shortening was logged ${logged.n} times, not once`);

  /* ── 4. And only once ── */
  await page.goto(`${BASE}/en/app/plan/amend`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const secondChance = await page.locator("#newEndDate").count();
  console.log(`  5. a second time   → ${secondChance === 0 ? "refused" : "STILL OFFERED"}`);
  if (secondChance > 0) {
    failures.push("the covenant offers a second amendment; it is meant to be once");
  }

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ settings save, and a covenant only ever comes closer — once");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
