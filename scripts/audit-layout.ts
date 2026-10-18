/**
 * Every key screen, on a phone and a laptop, with anything wider than the
 * screen called out.
 *
 *   npm run audit:layout                 dark theme
 *   THEME=light npm run audit:layout     light theme
 *   ONLY=home,mushaf npm run audit:layout
 *
 * Screenshots land in .logs/audit. Written when the whole type scale went up a
 * size, which is exactly the change that breaks a row on a 390px phone without
 * anything else noticing.
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const SITE = process.env.SITE ?? "http://localhost:3000";
const HOST = new URL(SITE).hostname;
const DOMAIN = "@audit.ahd.test";
const OUT = ".logs/audit";
const THEME = process.env.THEME ?? "dark";
const ONLY = process.env.ONLY?.split(",");

async function main() {
  mkdirSync(OUT, { recursive: true });
  const email = `a-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Aisha') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time, theme)
    values (${u.id}, 'uz', now(), 'Asia/Tashkent', 'alafasy', '05:30', ${THEME})`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status, niyyah)
    values (${u.id}, 'full', 1, 604, 9060, 300, now()::date - 20,
      (now() + interval '600 days')::date, (now() + interval '600 days')::date, 127, 12, 0, 'active',
      'Ota-onam uchun')`;
  /* Twenty whole pages, some of the last juz, and one page held in part — so
     every state the screens can show is on screen. */
  await sql`insert into memorization_units (user_id, page, state, strength, reps, first_memorized_at, last_reviewed_at)
    select ${u.id}, g, 'memorized', 40 + (g * 7) % 60, 3, now() - interval '9 days', now()
    from generate_series(1, 20) g`;
  await sql`insert into memorization_units (user_id, page, state, strength, reps, first_memorized_at, last_reviewed_at)
    select ${u.id}, g, 'memorized', 80, 3, now() - interval '30 days', now()
    from generate_series(590, 604) g`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;

  const b = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });

  const routes: [string, string][] = [
    ["home", "/app"],
    ["mushaf", "/app/quran"],
    ["reader", "/app/quran/3"],
    ["practice", "/app/practice"],
    ["settings", "/app/settings"],
    ["plan", "/app/plan"],
    ["landing", "/"],
    ["login", "/login"],
  ];

  for (const [device, viewport, scale] of [
    ["phone", { width: 390, height: 844 }, 2],
    ["laptop", { width: 1440, height: 900 }, 1],
  ] as const) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: scale, colorScheme: THEME === "light" ? "light" : "dark" });
    await ctx.addCookies([{ name: "ahd_session", value: token, domain: HOST, path: "/", httpOnly: true, secure: SITE.startsWith("https"), sameSite: "Lax" }]);
    /* Quiet the moving decoration so a shot is the layout, not a frame of it. */
    await ctx.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important}";
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log(`  PAGEERROR ${device}:`, String(e).slice(0, 160)));

    for (const [name, path] of routes) {
      if (ONLY && !ONLY.includes(name)) continue;
      await p.goto(`${SITE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(2200);

      /* Anything wider than the screen is a layout bug on a phone. */
      const overflow = await p.evaluate(() => {
        const w = document.documentElement.clientWidth;
        const wide: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = (el as HTMLElement).getBoundingClientRect();
          const cs = getComputedStyle(el);
          /* Decorative light is meant to spill and is clipped by the page. */
          const decorative =
            cs.pointerEvents === "none" ||
            /ahd-ground-wash|ahd-aurora|animate-breathe/.test(String((el as HTMLElement).className));
          /* Inside a sideways-scrolling row is scrolling, not overflowing. */
          let scroller = false;
          for (let up = el.parentElement; up; up = up.parentElement) {
            const ox = getComputedStyle(up).overflowX;
            if (ox === "auto" || ox === "scroll") { scroller = true; break; }
          }
          if (!decorative && !scroller && r.width > 0 && r.right > w + 1 && cs.position !== "fixed") {
            const tag = el.tagName.toLowerCase();
            const cls = String((el as HTMLElement).className).slice(0, 60);
            wide.push(`${tag}.${cls} (${Math.round(r.right)}px)`);
          }
        }
        return wide.slice(0, 4);
      });

      const body = await p.evaluate(() => getComputedStyle(document.documentElement).fontSize);
      console.log(`  ${device} ${name}: root ${body}${overflow.length ? " · OVERFLOW " + overflow.join(" | ") : ""}`);
      await p.screenshot({ path: `${OUT}/${THEME}-${device}-${name}.png` });
    }
    await ctx.close();
  }

  await b.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
}

main();
