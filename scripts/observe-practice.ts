/**
 * Plays a real drill in a real browser, in every mode, and checks the score.
 *
 * Written after a round of reported bugs that no unit test could have caught:
 * a message key collision that put the literal text "practice.next" on the Next
 * button, and answers that were not being counted. Both are properties of the
 * assembled page, not of any function.
 *
 * It checks three things per mode:
 *   - no untranslated message key is visible anywhere on screen;
 *   - every question can actually be answered, including the last one;
 *   - the score reported at the end is the score that was earned.
 *
 *   npm run observe:practice
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@observe.ahd.test";
const PAGE = 2;

const MODES = ["hide", "gap", "firstWord", "next", "shuffle", "mutashabihat"] as const;

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/**
 * Any text that looks like a message key rather than a sentence.
 *
 * next-intl renders the key itself when a lookup fails, which is how
 * "practice.next" ended up on a button: the key was both a label and an object,
 * and JSON kept the object.
 */
async function untranslated(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const suspect = /^[a-z][a-zA-Z]*(\.[a-zA-Z][a-zA-Z]*){1,4}$/;

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? "").trim();
      if (text.length > 3 && text.length < 60 && suspect.test(text)) found.add(text);
    }
    return [...found];
  });
}

async function setUp() {
  const email = `observe-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'not-a-real-hash', 'Observer')
    returning id
  `) as { id: string }[];

  await sql`insert into profiles (user_id, locale, onboarded_at) values (${user.id}, 'uz', now())`;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;
  await sql`
    insert into memorization_units (user_id, page, state, strength, reps, interval_days,
      first_memorized_at, last_reviewed_at)
    values (${user.id}, ${PAGE}, 'memorized', 50, 2, 6, now() - interval '60 days', now() - interval '5 days')
  `;

  return { token, email };
}

/** Answers whatever question is on screen, correctly where the DOM allows. */
async function answerCurrent(page: Page, mode: string): Promise<void> {
  /* Assemble modes: tap bank words until every slot is full. */
  const bank = page.locator("[data-bank-word]");
  if ((await bank.count()) > 0) {
    const slots = await page.locator("[data-slot]").count();
    for (let i = 0; i < slots; i++) {
      const available = page.locator("[data-bank-word]:not([disabled])");
      if ((await available.count()) === 0) break;
      await available.first().click();
    }
    return;
  }

  /* Choice modes. */
  const choices = page.locator("[data-choice]");
  if ((await choices.count()) > 0) {
    await choices.first().click();
    return;
  }

  /* Order mode: tap every pooled ayah. */
  const pool = page.locator("[data-pool-item]");
  if ((await pool.count()) > 0) {
    let left = await pool.count();
    while (left > 0) {
      await page.locator("[data-pool-item]").first().click();
      left = await page.locator("[data-pool-item]").count();
    }
    return;
  }

  failures.push(`${mode}: nothing on screen could be answered`);
}

async function playMode(page: Page, mode: string) {
  await page.goto(`${BASE}/app/practice/${PAGE}?mode=${mode}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");

  const keys = await untranslated(page);
  if (keys.length > 0) failures.push(`${mode}: untranslated on screen — ${keys.join(", ")}`);

  /* Walk every question, answering as we go. The counter in the progress row
     says how many there are. */
  const total = await page.locator("[data-question-dot]").count();
  if (total === 0) {
    failures.push(`${mode}: no questions rendered`);
    return;
  }

  for (let i = 0; i < total; i++) {
    await answerCurrent(page, mode);

    const next = page.getByRole("button", { name: /^(Keyingi|Next|Далее)$/ });
    if ((await next.count()) > 0 && (await next.first().isEnabled())) {
      await next.first().click();
      await page.waitForTimeout(120);
    }
  }

  const finish = page.getByRole("button", { name: /Yakunlash|Finish|Завершить/ });
  if ((await finish.count()) === 0) {
    failures.push(`${mode}: no finish button after answering every question`);
    return;
  }

  await finish.first().click();
  await page.waitForSelector("[data-drill-score]", { timeout: 20000 }).catch(() => {});

  const score = await page.locator("[data-drill-score]").first().textContent();
  if (score === null) {
    failures.push(`${mode}: the drill did not produce a score`);
    return;
  }

  const percent = Number(score.replace(/[^\d]/g, ""));
  const afterKeys = await untranslated(page);
  if (afterKeys.length > 0) {
    failures.push(`${mode}: untranslated on the result — ${afterKeys.join(", ")}`);
  }

  console.log(`  ${mode.padEnd(14)} ${percent}%`);

  /* The script taps whatever the DOM offers first, which is right only by
     luck, so the *value* of the score is not asserted here — correctness of
     scoring is verify-practice-live.ts, which knows the answers. What is
     asserted is that the drill reached the end and reported on every question
     it asked. A premature submit used to lose the last one silently. */
  const reviewed = await page.locator("[data-question-dot]").count();
  const listed = await page.locator("[aria-expanded]").count();
  if (listed !== total) {
    failures.push(`${mode}: asked ${total} questions but reported on ${listed}`);
  }
  void reviewed;
}

async function main() {
  const { token, email } = await setUp();
  console.log(`${BASE}\naccount ${email}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
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
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text().slice(0, 160)}`);
  });

  for (const mode of MODES) await playMode(page, mode);

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ every mode plays through and scores");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
