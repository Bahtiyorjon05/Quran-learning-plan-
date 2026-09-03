/**
 * Screenshots the signed-in screens, so the design can be looked at.
 *
 * Builds one account with a plausible hifz in progress — a covenant part-way
 * through, a spread of pages at different strengths, a handful of recorded
 * mistakes — signs a browser in as them, and writes a PNG per screen per
 * theme. Nothing here asserts; the point is to see.
 *
 *   npx tsx scripts/shoot-app.ts [--width 1280] [--theme dark|light]
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@shoot.ahd.test";
/* Inside the project, not a system temp directory: screenshots are something
   you want to open, compare and keep for as long as a design change takes.
   Ignored by git — see .gitignore. */
const OUT = "screenshots";

const sql = neon(process.env.DATABASE_URL!);

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
};

const SCREENS = [
  ["dashboard", "/app"],
  ["practice", "/app/practice"],
  ["mushaf", "/app/quran"],
  ["mistakes", "/app/mistakes"],
  ["plan-new", "/app/plan/new"],
  ["admin", "/admin"],
  ["admin-people", "/admin/users"],
  ["home", "/"],
] as const;

const overflows: string[] = [];

async function main() {
  mkdirSync(OUT, { recursive: true });

  const width = Number(arg("width", "1440"));
  const themes = arg("theme", "dark,light").split(",");

  /* ── An account midway through a three-year covenant ── */
  const email = `shot-${Date.now()}${DOMAIN}`;
  /* Admin, so the admin screens can be photographed too. The account is
     deleted at the end of the run like every other seeded row. */
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name, role)
    values (${email}, now(), 'not-a-real-hash', 'Bahtiyorjon', 'admin') returning id
  `) as { id: string }[];

  await sql`
    insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${user.id}, 'uz', now(), 'Asia/Tashkent', 'alafasy', '05:30')
  `;

  /* 9060 lines is the whole mushaf; ~1,850 done is a believable year in. */
  await sql`
    insert into plans (user_id, scope, total_lines, completed_lines, niyyah,
                       start_date, original_end_date, current_end_date,
                       study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${user.id}, 'full', 9060, 1850,
            'Alloh roziligi uchun, ota-onam uchun sadaqa jariya boʻlsin.',
            (now() - interval '390 days')::date,
            (now() + interval '710 days')::date,
            (now() + interval '710 days')::date,
            127, 12, 0, 'active')
  `;

  /* A spread across the mushaf: juz 30 solid, juz 1 strong, a fraying middle. */
  const pages: [number, number, number][] = [];
  for (let p = 582; p <= 604; p++) pages.push([p, 78 + ((p * 7) % 22), 2 + (p % 9)]);
  for (let p = 1; p <= 96; p++) pages.push([p, 40 + ((p * 13) % 55), 1 + (p % 34)]);
  for (let p = 300; p <= 330; p++) pages.push([p, 14 + ((p * 5) % 40), 12 + (p % 40)]);

  for (const [page, strength, days] of pages) {
    await sql`
      insert into memorization_units
        (user_id, page, state, strength, reps, interval_days, first_memorized_at, last_reviewed_at)
      values (${user.id}, ${page}, 'memorized', ${strength}, 3, 6,
              now() - interval '200 days', now() - make_interval(days => ${days}))
      on conflict (user_id, page) do nothing
    `;
  }

  for (const [surah, ayah, word] of [[2, 255, 3], [2, 255, 7], [2, 255, 3], [4, 12, 2], [7, 141, 5]]) {
    await sql`
      insert into mistakes (user_id, page, surah, ayah, word_index, kind)
      values (${user.id}, 42, ${surah}, ${ayah}, ${word}, 'forgot')
    `;
  }

  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  for (const theme of themes) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme: theme === "light" ? "light" : "dark",
    });
    await context.addCookies([
      { name: "ahd_session", value: token, domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax" },
    ]);

    /* The theme lives in localStorage and is applied by an inline script before
       first paint, so it has to be in place before the document runs — a cookie
       does nothing, and setting it afterwards would photograph the wrong one. */
    await context.addInitScript((chosen) => {
      try {
        window.localStorage.setItem("ahd-theme", chosen as string);
      } catch {
        /* private mode; the shot falls back to the device preference */
      }
    }, theme);
    const page = await context.newPage();

    for (const [name, path] of SCREENS) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

      /* Walk the whole page first. Anything revealed by an IntersectionObserver
         — the mushaf mosaic above all — stays at opacity 0 until it has been
         on screen once, and a full-page screenshot does not scroll. */
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 140));
        }
        window.scrollTo(0, 0);
      });

      /* Let the arrival animations finish before the shutter. */
      await page.waitForTimeout(2600);
      /* Horizontal overflow is the one responsiveness bug that is a fact
         rather than a matter of taste, so it is measured rather than eyeballed:
         a page whose scrollWidth exceeds its viewport slides sideways under the
         thumb, and on a phone that is always wrong. */
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        if (doc.scrollWidth <= doc.clientWidth + 1) return null;

        /* scrollWidth alone over-reports. A decorative blur inside a section
           with overflow-hidden still measures wider than the viewport while
           being perfectly well behaved, and `overflow-x: hidden` on the body
           already stops the page moving. The question that matters to a thumb
           is whether the page can actually be dragged sideways, so ask it. */
        const before = window.scrollX;
        window.scrollTo(doc.clientWidth, window.scrollY);
        const moved = window.scrollX > before;
        window.scrollTo(before, window.scrollY);
        if (!moved) return null;

        /* Name the widest offender, or the report is unactionable. */
        const guilty = [...document.querySelectorAll<HTMLElement>("body *")]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.right > doc.clientWidth + 1)
          .sort((a, b) => b.r.right - a.r.right)[0];

        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          widest: guilty
            ? `${guilty.el.tagName.toLowerCase()}.${String(guilty.el.className).slice(0, 60)} → right ${Math.round(guilty.r.right)}`
            : "unknown",
        };
      });

      if (overflow) {
        overflows.push(
          `${name} @${width} ${theme}: scrolls to ${overflow.scrollWidth}px in a ${overflow.clientWidth}px viewport — ${overflow.widest}`,
        );
      }

      const file = `${OUT}/${name}-${theme}-${width}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ${name.padEnd(12)} ${theme.padEnd(5)} → ${file.split("/").pop()}${overflow ? "  ⚠ OVERFLOWS" : ""}`);
    }
    await context.close();
  }

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (overflows.length > 0) {
    console.error(`\n✗ ${overflows.length} screens scroll sideways:`);
    for (const line of overflows) console.error(`  ${line}`);
    process.exitCode = 1;
  } else {
    console.log("✓ no screen scrolls sideways");
  }
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
