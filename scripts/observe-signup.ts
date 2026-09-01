/**
 * Walks a brand-new account through the whole gate, in a real browser.
 *
 * Sign up, verify, choose a password, onboard, and land on the dashboard. This
 * is the one path every single person takes and the one nobody re-tests, so it
 * is walked here end to end rather than trusted.
 *
 * The code is recovered by hashing candidates against the stored hash rather
 * than read from an inbox: it is HMAC'd with AUTH_SECRET, which this machine
 * has, and a million of those takes about a second.
 *
 *   npm run observe:signup
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@signup.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** The code that was mailed, recovered from its hash. */
async function recoverCode(userId: string): Promise<string | null> {
  const { hashOtp } = await import("../src/auth/codes");
  const [row] = (await sql`
    select code_hash from email_verification_codes
    where user_id = ${userId} and consumed_at is null
    order by created_at desc limit 1
  `) as { code_hash: string }[];
  if (!row) return null;

  for (let n = 0; n < 1_000_000; n++) {
    const candidate = String(n).padStart(6, "0");
    if (hashOtp(userId, candidate) === row.code_hash) return candidate;
  }
  return null;
}

async function typeCode(page: Page, code: string) {
  const boxes = page.locator("input[inputmode='numeric'], input[autocomplete='one-time-code']");
  if ((await boxes.count()) > 1) {
    for (let i = 0; i < code.length; i++) await boxes.nth(i).fill(code[i]);
  } else {
    await boxes.first().fill(code);
  }
}

async function main() {
  const email = `new-${Date.now()}${DOMAIN}`;
  console.log(`${BASE}\naccount ${email}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext()).newPage();

  page.on("pageerror", (e) => failures.push(`page error: ${e.message.slice(0, 140)}`));

  /* Onboarding must be posted exactly once, by the finish button. It used to
     post on "Continue" as well, because React reused one DOM node for the two
     footer buttons and flipped its type mid-click — which skipped the second
     step and onboarded everyone with the defaults. Counting the posts is the
     only way to see that from outside. */
  let onboardingPosts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && /\/onboarding$/.test(new URL(r.url()).pathname)) {
      onboardingPosts += 1;
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error") failures.push(`console: ${m.text().slice(0, 140)}`);
  });

  /* ── 1. Sign up ── */
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.locator("input[type='email']").first().fill(email);
  await page.locator("form button[type='submit']").first().click();
  await page.waitForURL(/verify-email/, { timeout: 20000 }).catch(() => {});
  console.log(`  1. signed up      → ${new URL(page.url()).pathname}`);
  if (!/verify-email/.test(page.url())) failures.push("signup did not reach verify-email");

  const [user] = (await sql`select id from users where email = ${email}`) as { id: string }[];
  if (!user) {
    failures.push("no account row was created");
    await finish(browser, email);
    return;
  }

  /* ── 2. Every wrong code must clear itself, not just the first ── */
  const code = await recoverCode(user.id);
  if (!code) {
    failures.push("no verification code was issued");
    await finish(browser, email);
    return;
  }

  /* Three in a row, because the bug was that only the first one cleared: the
     field keys off the attempt finishing now, and `invalid` never changes
     between one rejection and the next. Three wrong plus the real one stays
     inside OTP_MAX_ATTEMPTS. */
  const wrongCodes = ["000000", "111111", "222222"].filter((c) => c !== code);

  for (const [i, wrong] of wrongCodes.entries()) {
    await typeCode(page, wrong);
    await page.waitForTimeout(2500);

    const left = (
      await page.evaluate(() =>
        [...document.querySelectorAll<HTMLInputElement>("input")].map((n) => n.value).join(""),
      )
    ).replace(/\D/g, "");

    console.log(`  2.${i + 1} wrong code ${wrong} → boxes hold "${left}"`);
    if (left.length > 0) {
      failures.push(
        `wrong code number ${i + 1} was left in the boxes to be deleted by hand`,
      );
      break;
    }
  }

  /* ── 3. And the right one is still accepted afterwards ── */
  await typeCode(page, code);
  await page.waitForURL(/set-password/, { timeout: 20000 }).catch(() => {});
  console.log(`  3. verified       → ${new URL(page.url()).pathname}`);
  if (!/set-password/.test(page.url())) {
    failures.push(`verifying landed on ${new URL(page.url()).pathname}, not set-password`);
    await finish(browser, email);
    return;
  }

  /* ── 4. Name and password ── */
  const name = page.locator("input[name='displayName'], input[type='text']").first();
  if ((await name.count()) > 0) await name.fill("New Reciter");
  const passwords = page.locator("input[type='password']");
  const count = await passwords.count();
  for (let i = 0; i < count; i++) await passwords.nth(i).fill("a-long-enough-passphrase-42");
  await page.locator("form button[type='submit']").first().click();
  await page.waitForURL(/onboarding/, { timeout: 20000 }).catch(() => {});
  console.log(`  4. password set   → ${new URL(page.url()).pathname}`);
  if (!/onboarding/.test(page.url())) {
    failures.push(`setting a password landed on ${new URL(page.url()).pathname}, not onboarding`);
    await finish(browser, email);
    return;
  }

  /* ── 5. Onboarding, all the way through ── */
  await page.waitForLoadState("networkidle");

  /* Both answers are deliberately *not* the defaults. If a step is skipped the
     profile keeps the default, and that is what the assertions below catch. */
  const moment = page.getByRole("button", { name: /Xuftondan keyin|After Isha|После иша/ });
  if ((await moment.count()) === 0) failures.push("onboarding step one offers no study time");
  else await moment.first().click();

  const next = page.getByRole("button", { name: /Davom etish|Continue|Продолжить|Next|Далее/ });
  if ((await next.count()) === 0) failures.push("onboarding has no way forward from step one");
  else {
    await next.first().click();
    await page.waitForTimeout(500);
  }

  if (onboardingPosts > 0) {
    failures.push("moving to step two submitted the onboarding form on its own");
  }

  /* Step two: a reciter, again not the default one. */
  const reciter = page.getByRole("button", { name: /Xusariy|Husary|Хусари/ });
  if ((await reciter.count()) === 0) failures.push("onboarding step two offers no reciter");
  else await reciter.first().click();

  const submit = page.getByRole("button", {
    name: /Yakunlash|Finish|Завершить|boshlash|start/i,
  });
  console.log(`  5. finish button  → ${(await submit.count()) > 0 ? "present" : "MISSING"}`);
  if ((await submit.count()) === 0) {
    failures.push("onboarding has no finish button on step two");
    await finish(browser, email);
    return;
  }

  await submit.first().click();
  await page.waitForURL((url) => /\/app$/.test(url.pathname), { timeout: 25000 }).catch(() => {});
  console.log(`  6. onboarded      → ${new URL(page.url()).pathname}`);

  if (!/\/app$/.test(new URL(page.url()).pathname)) {
    failures.push(`finishing onboarding landed on ${new URL(page.url()).pathname}, not /app`);
  }

  /* And it must have actually been written, or the guard sends them back. */
  const [profile] = (await sql`
    select onboarded_at, time_zone, preferred_reciter, study_time
    from profiles where user_id = ${user.id}
  `) as Record<string, unknown>[];
  console.log(`  7. profile        → ${JSON.stringify(profile)}`);
  if (!profile) failures.push("the account has no profile row at all");
  else if (!profile.onboarded_at) failures.push("onboarding did not record that it finished");
  else {
    if (profile.preferred_reciter !== "husary") {
      failures.push(
        `step two was not honoured: the reciter is ${String(profile.preferred_reciter)}, not the chosen husary`,
      );
    }
    if (!String(profile.study_time ?? "").startsWith("20:30")) {
      failures.push(
        `step one was not honoured: the study time is ${String(profile.study_time)}, not the chosen 20:30`,
      );
    }
  }

  /* ── 6. And coming back lands on the dashboard, not the corridor ── */
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  console.log(`  8. revisiting /app → ${new URL(page.url()).pathname}`);
  if (!/\/app$/.test(new URL(page.url()).pathname)) {
    failures.push(`a finished account is bounced from /app to ${new URL(page.url()).pathname}`);
  }

  await finish(browser, email);
}

async function finish(browser: { close: () => Promise<void> }, email: string) {
  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ a new account gets all the way to the dashboard");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
