/**
 * Checks how long a sign-in lasts, and where the installed app opens.
 *
 * Two promises live here that nothing else tests. A session is meant to
 * survive three days *without use* — sliding, so somebody who opens Ahd every
 * morning is never signed out — and an installed icon is meant to open on the
 * dashboard rather than on the marketing page.
 *
 * Both are easy to break silently: the database row and the cookie each carry
 * half of the expiry, and a cookie whose lifetime is fixed at sign-in will
 * throw a faithful daily user out on the third day while the row still says
 * the session is valid.
 *
 *   npm run observe:session
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium, type BrowserContext } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@session.ahd.test";
const PASSWORD = "a-long-enough-passphrase-42";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** Seconds until the session cookie expires, or null if there is none. */
async function cookieLife(context: BrowserContext): Promise<number | null> {
  const jar = await context.cookies();
  const cookie = jar.find((c) => c.name === "ahd_session");
  if (!cookie || cookie.expires === -1) return null;
  return Math.round(cookie.expires - Date.now() / 1000);
}

async function main() {
  const { SESSION_TTL_DAYS } = await import("../src/auth/constants");
  const { hashPassword } = await import("../src/auth/password");

  console.log(`${BASE}\nsessions are meant to last ${SESSION_TTL_DAYS} days without use\n`);

  const email = `s-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), ${await hashPassword(PASSWORD)}, 'Session') returning id
  `) as { id: string }[];
  await sql`
    insert into profiles (user_id, locale, onboarded_at) values (${user.id}, 'uz', now())
  `;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  /* ── 1. Signing in ── */
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("input[type='email']").first().fill(email);
  await page.locator("input[type='password']").first().fill(PASSWORD);
  await page.locator("form button[type='submit']").first().click();
  await page.waitForURL(/\/app$/, { timeout: 25000 }).catch(() => {});

  console.log(`  1. signed in       → ${new URL(page.url()).pathname}`);
  if (!/\/app$/.test(new URL(page.url()).pathname)) {
    failures.push(`signing in landed on ${new URL(page.url()).pathname}, not the dashboard`);
  }

  /* ── 2. The cookie carries the same window as the row ── */
  const life = await cookieLife(context);
  const wanted = SESSION_TTL_DAYS * 86_400;
  console.log(
    `  2. cookie lasts    → ${life === null ? "session-only" : `${(life / 86_400).toFixed(2)} days`}`,
  );
  if (life === null) {
    failures.push("the session cookie has no expiry, so it dies when the browser closes");
  } else if (Math.abs(life - wanted) > 3_600) {
    failures.push(
      `the cookie lasts ${(life / 86_400).toFixed(2)} days but a session is meant to last ${SESSION_TTL_DAYS}`,
    );
  }

  /* ── 3. Coming back goes straight in, and does not ask again ── */
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  console.log(`  3. returning       → ${new URL(page.url()).pathname}`);
  if (!/\/app$/.test(new URL(page.url()).pathname)) {
    failures.push("a signed-in visitor is asked to sign in again on their next visit");
  }

  /* Asking for the sign-in page while already signed in must not show a form. */
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  console.log(`  4. /login while in → ${new URL(page.url()).pathname}`);
  if (/login/.test(new URL(page.url()).pathname)) {
    failures.push("an already signed-in visitor is shown the sign-in form again");
  }

  /* ── 5. The expiry slides, rather than counting down from sign-in ── */
  const before = await cookieLife(context);
  await new Promise((r) => setTimeout(r, 2500));
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  const after = await cookieLife(context);
  const slid = before !== null && after !== null && after >= before;
  console.log(`  5. expiry slides   → ${slid ? "yes" : "NO — it counts down from sign-in"}`);
  if (!slid) {
    failures.push(
      "the cookie's expiry is fixed at sign-in, so a daily user is signed out on the third day",
    );
  }

  /* ── 6. Where an installed icon opens ── */
  const manifest = (await (await page.request.get(`${BASE}/manifest.webmanifest`)).json()) as {
    start_url?: string;
  };
  console.log(`  6. installed opens → ${manifest.start_url}`);
  if (!manifest.start_url || !manifest.start_url.startsWith("/app")) {
    failures.push(
      `an installed icon opens ${manifest.start_url} — it should open the dashboard, not the landing page`,
    );
  }

  /* ── 7. And a lapsed session is asked to sign in again ── */
  await sql`update sessions set expires_at = now() - interval '1 hour' where user_id = ${user.id}`;
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  console.log(`  7. after it lapses → ${new URL(page.url()).pathname}`);
  if (!/login/.test(new URL(page.url()).pathname)) {
    failures.push(
      `an expired session still reaches ${new URL(page.url()).pathname} instead of the sign-in page`,
    );
  }

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ sessions last three days of absence, and the installed app opens the dashboard");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
