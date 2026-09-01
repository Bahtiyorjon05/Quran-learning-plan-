/**
 * Checks the weak-spot screen against real recorded mistakes.
 *
 * The data has been written by every drill since the practice engine shipped
 * and never read back, so this is the first thing that proves the read path
 * agrees with the write path — including resolving, which must hide a spot
 * without deleting the record the admin report rests on.
 *
 *   npm run observe:mistakes
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@weakspot.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  /* ── Someone with a history of specific mistakes ── */
  const email = `weak-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'not-a-real-hash', 'Weak') returning id
  `) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at) values (${user.id}, 'uz', now())`;

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  /* 2:255 missed four times on two words; 2:49 confused with 7:141 twice. */
  for (const word of [3, 3, 7, 3]) {
    await sql`
      insert into mistakes (user_id, page, surah, ayah, word_index, kind)
      values (${user.id}, 42, 2, 255, ${word}, 'forgot')
    `;
  }
  for (let i = 0; i < 2; i++) {
    await sql`
      insert into mistakes (user_id, page, surah, ayah, word_index, kind, linked_surah, linked_ayah)
      values (${user.id}, 7, 2, 49, ${i}, 'mutashabih', 7, 141)
    `;
  }
  /* And one already put right, which must not appear. */
  await sql`
    insert into mistakes (user_id, page, surah, ayah, word_index, kind, resolved_at)
    values (${user.id}, 3, 2, 10, 1, 'forgot', now())
  `;

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

  console.log(`${BASE}\n`);

  await page.goto(`${BASE}/app/mistakes`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();

  /* ── What it says ── */
  const rows = await page.locator("main ul > li").count();
  console.log(`  weak spots listed: ${rows}`);
  if (rows !== 2) failures.push(`expected 2 unresolved ayahs, found ${rows}`);

  for (const [what, present] of [
    ["Ayat al-Kursi named", /2:255/.test(text)],
    ["the confusion named", /2:49/.test(text)],
    ["the resolved one hidden", !/2:10\b/.test(text)],
    ["counted four misses", /4/.test(text)],
    ["marked as a confusion", /adashtirilgan|confused|спутано/i.test(text)],
  ] as const) {
    console.log(`  ${present ? "✓" : "✗"} ${what}`);
    if (!present) failures.push(what);
  }

  /* ── The missed words are marked inside the ayah ── */
  const marked = await page.locator("[dir='rtl'] span.text-danger").count();
  console.log(`  words marked in the text: ${marked}`);
  if (marked === 0) failures.push("no missed words are marked inside the ayah");

  /* ── The drill link matches the kind of mistake ── */
  const confusionLink = await page.locator("a[href*='mode=mutashabihat']").count();
  const wordLink = await page.locator("a[href*='mode=gap']").count();
  console.log(`  drill links: ${wordLink} word, ${confusionLink} confusion`);
  if (confusionLink === 0) failures.push("a confusion does not link to the mutashabihat drill");
  if (wordLink === 0) failures.push("a lost word does not link to the gap drill");

  /* ── Resolving hides it, and keeps the record ── */
  await page.getByRole("button", { name: /Endi bilaman|I have this now|Теперь помню/ }).first().click();
  await page.waitForTimeout(1800);

  const after = await page.locator("main ul > li").count();
  console.log(`  after clearing one: ${after} left`);
  if (after !== 1) failures.push(`clearing left ${after} spots, expected 1`);

  const [counts] = (await sql`
    select count(*)::int as total,
           count(*) filter (where resolved_at is not null)::int as resolved
    from mistakes where user_id = ${user.id}
  `) as { total: number; resolved: number }[];

  console.log(`  rows in the database: ${counts.total} total, ${counts.resolved} resolved`);
  if (counts.total !== 7) failures.push(`resolving deleted rows: ${counts.total} left of 7`);
  if (counts.resolved < 2) failures.push("resolving did not mark the rows resolved");

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("test account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ the weak spots read back, and clearing one keeps the record");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
