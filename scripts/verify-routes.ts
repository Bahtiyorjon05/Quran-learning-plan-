/**
 * Walks every route, signed out and signed in, and reports anything that is
 * not the status it should be.
 *
 * Faster and more certain than reading logs: a log only shows the errors
 * somebody already hit, and this finds the ones nobody has hit yet.
 *
 *   npm run verify:routes
 *   VERIFY_BASE_URL=https://ahd-quran.vercel.app npm run verify:routes
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium, type Page } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@routecheck.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

/** Routes anyone can reach, in all three languages. */
const PUBLIC = [
  "/",
  "/quran",
  "/quran/1",
  "/quran/2",
  "/quran/604",
  "/about",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/forgot-password",
];

/** Routes that need an account. */
const PRIVATE = [
  "/app",
  "/app/quran",
  "/app/quran/1",
  "/app/quran/2",
  "/app/practice",
  "/app/practice/2",
  "/app/plan/new",
];

async function status(path: string, token?: string): Promise<number> {
  const response = await fetch(`${BASE}${path}`, {
    headers: token ? { cookie: `ahd_session=${token}` } : {},
    redirect: "manual",
  });
  return response.status;
}

/**
 * What is actually on screen — never the HTML source.
 *
 * The first version of this grepped the response body and flagged every page,
 * because next-intl ships the whole message catalogue to the client and that
 * catalogue contains the words "something went wrong". Reading rendered text
 * is the only way to tell a displayed error from a string that merely travelled.
 */
async function looksBroken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const text = document.body.innerText;

    if (/Application error: a (server|client)-side exception/i.test(text)) {
      return "Next's client exception page";
    }
    if (/Nimadir noto|Something went wrong|Что-то пошло не так/i.test(text)) {
      return "the app's own error page";
    }

    /* An untranslated key rendered as text — the "practice.next" class of bug. */
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const suspect = /^[a-z][a-zA-Z]*(\.[a-zA-Z][a-zA-Z]*){1,4}$/;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const value = (node.textContent ?? "").trim();
      if (value.length > 3 && value.length < 60 && suspect.test(value)) {
        return `an untranslated key on screen: ${value}`;
      }
    }
    return null;
  });
}

async function main() {
  console.log(`${BASE}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  /* ── Public, in every language ── */
  let checked = 0;
  for (const prefix of ["", "/en", "/ru"]) {
    for (const path of PUBLIC) {
      const url = `${prefix}${path === "/" ? "" : path}` || "/";
      const code = await status(url);
      checked++;

      if (code !== 200) {
        failures.push(`${url} → ${code}`);
        continue;
      }
      await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" });
      const broken = await looksBroken(page);
      if (broken) failures.push(`${url} rendered ${broken}`);
    }
  }
  console.log(`  ${checked} public routes, three languages`);

  /* ── Signed in ── */
  const email = `route-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'not-a-real-hash', 'Route') returning id
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
    values (${user.id}, 2, 'memorized', 50, 2, 6, now() - interval '30 days', now() - interval '3 days')
  `;

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

  for (const path of PRIVATE) {
    const code = await status(path, token);
    if (code !== 200) {
      failures.push(`${path} (signed in) → ${code}`);
      continue;
    }
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    const broken = await looksBroken(page);
    if (broken) failures.push(`${path} (signed in) rendered ${broken}`);
  }
  console.log(`  ${PRIVATE.length} signed-in routes`);

  await browser.close();

  /* ── The audio every listed reciter would request ── */
  const { RECITERS, ayahAudioUrl } = await import("../src/lib/reciters");
  for (const r of RECITERS) {
    if (r.kind !== "ayah") continue;
    for (const [surah, ayah] of [
      [1, 1],
      [2, 1],
      [114, 6],
    ] as const) {
      const url = ayahAudioUrl(r.id, surah, ayah);
      const response = await fetch(url, { method: "GET", headers: { range: "bytes=0-512" } });
      if (!response.ok) {
        failures.push(`${r.id} audio for ${surah}:${ayah} → ${response.status}`);
      }
    }
  }
  console.log(`  audio for every per-ayah reciter`);

  await sql`delete from users where email like ${"%" + DOMAIN}`;

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ every route answers, and every reciter plays");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
