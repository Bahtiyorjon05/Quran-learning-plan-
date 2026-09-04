/**
 * The number on the dashboard means what it says.
 *
 * This existed because the same reader saw "2%" above "23 pages held" and was
 * right to call it nonsense. Two functions were writing one column with two
 * different definitions of "completed" — every memorized page in one, the
 * unbroken run from the start of the scope in the other — and whichever ran
 * last won.
 *
 * So the shape of that reader's data is reproduced exactly: twenty-three pages
 * held, but only fourteen of them in a run from page one. The frontier is
 * therefore 210 lines and the honest answer is 23/604. If the arc ever shows
 * the frontier again, this fails.
 *
 *   npm run observe:progress
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@progress.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** Fourteen from the start, nine far away — twenty-three pages, one gap. */
const RUN = Array.from({ length: 14 }, (_, i) => i + 1);
const AWAY = Array.from({ length: 9 }, (_, i) => 582 + i);
const HELD = [...RUN, ...AWAY];

async function main() {
  console.log(`${BASE}\n`);

  const email = `p-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Progress') returning id
  `) as { id: string }[];
  await sql`
    insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${user.id}, 'en', now(), 'Asia/Seoul', 'alafasy', '05:30')
  `;
  await sql`
    insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
                       start_date, original_end_date, current_end_date,
                       study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${user.id}, 'full', 1, 604, 9060, 210,
            (now() - interval '60 days')::date,
            (now() + interval '900 days')::date, (now() + interval '900 days')::date,
            127, 12, 0, 'active')
  `;
  for (const page of HELD) {
    await sql`
      insert into memorization_units (user_id, page, state, strength, first_memorized_at, last_reviewed_at)
      values (${user.id}, ${page}, 'memorized', 3, now(), now())
    `;
  }

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.addCookies([
    {
      name: "ahd_session",
      value: token,
      domain: new URL(BASE).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  await page.goto(`${BASE}/en/app`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const seen = await page.evaluate(() => {
    const text = document.body.innerText;
    const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
    const held = text.match(/(\d+)\s*\n?\s*pages held/i);
    return { pct: pct ? pct[1] : null, held: held ? held[1] : null, sample: text.slice(0, 0) };
  });

  console.log(`  held in the database   → ${HELD.length} pages (${RUN.length} of them in a run)`);
  console.log(`  the arc reads          → ${seen.pct}%`);
  console.log(`  the stat beside it     → ${seen.held} pages held`);

  const expected = Math.round((HELD.length / 604) * 100);
  if (seen.pct === null) {
    failures.push("no percentage was rendered on the dashboard at all");
  } else if (Number(seen.pct) !== expected) {
    failures.push(
      `the arc shows ${seen.pct}% for ${HELD.length}/604 pages; ${expected}% is the honest figure` +
        (Number(seen.pct) === 2 ? " — this is the schedule frontier leaking back in" : ""),
    );
  }
  if (seen.held !== String(HELD.length)) {
    failures.push(`the stat says ${seen.held} pages held, not ${HELD.length}`);
  }

  /* The two numbers must agree with each other, which is the actual complaint:
     one saying 2% while the other says 23 pages is what looked broken. */
  if (seen.pct && seen.held) {
    const fromStat = Math.round((Number(seen.held) / 604) * 100);
    console.log(`  do they agree?         → ${fromStat === Number(seen.pct) ? "yes" : "NO"}`);
    if (fromStat !== Number(seen.pct)) {
      failures.push(
        `the arc (${seen.pct}%) and the pages-held stat (${seen.held}/604 = ${fromStat}%) disagree`,
      );
    }
  }

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ the arc and the pages-held stat tell the same story");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
