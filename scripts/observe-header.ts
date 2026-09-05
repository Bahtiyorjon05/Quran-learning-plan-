/**
 * The signed-in header, on the width where it was broken.
 *
 * Six round icons — admin, settings, install, language, theme, log out — sat
 * side by side beside the wordmark, and on a phone they overlapped each other.
 * They now split by kind: language and theme stay in the open because they
 * change how the page in front of you reads, and everything about the account
 * collects behind one menu.
 *
 * So this measures rather than eyeballs: it counts the controls actually left
 * in the bar, checks none of them overlap at 360px, and opens the menu to see
 * that settings, admin, install and logout are all inside it.
 *
 *   npm run observe:header
 */
import { createHash, randomBytes } from "node:crypto";

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";

config({ path: ".env.local", quiet: true });

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const DOMAIN = "@header.ahd.test";

const sql = neon(process.env.DATABASE_URL!);
const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);

  /* An admin, because the admin link is one of the things that used to crowd
     the bar and now has to be found inside the menu. */
  const email = `h-${Date.now()}${DOMAIN}`;
  const [user] = (await sql`
    insert into users (email, email_verified_at, password_hash, display_name, role)
    values (${email}, now(), 'x', 'Abdulloh Test', 'admin') returning id
  `) as { id: string }[];
  await sql`
    insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${user.id}, 'uz', now(), 'Asia/Seoul', 'alafasy', '05:30')
  `;
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into sessions (user_id, token_hash, expires_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')
  `;

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 360, height: 780 } });
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

  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("header", { timeout: 20_000 });
  await page.waitForTimeout(1200);

  /* ── Nothing in the bar may overlap anything else ── */
  const overlap = await page.evaluate(() => {
    const bar = document.querySelector("header")!;
    const boxes = [...bar.querySelectorAll("a,button")]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const clashes: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        /* Nested controls (a button inside a form) legitimately contain each
           other; only side-by-side controls cutting into each other count. */
        const contains =
          (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom) ||
          (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom);
        if (contains) continue;
        const hit = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        if (hit) clashes.push(`${a.left.toFixed(0)}-${a.right.toFixed(0)} × ${b.left.toFixed(0)}-${b.right.toFixed(0)}`);
      }
    }
    return { count: boxes.length, clashes, barRight: bar.getBoundingClientRect().right };
  });

  console.log(`  1. controls in the bar → ${overlap.count}`);
  console.log(`  2. overlapping pairs   → ${overlap.clashes.length === 0 ? "none" : overlap.clashes.join(", ")}`);
  if (overlap.clashes.length > 0) {
    failures.push(`${overlap.clashes.length} pair(s) of header controls overlap at 360px`);
  }

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`  3. sideways overflow   → ${overflow}px`);
  if (overflow > 1) failures.push(`the page scrolls sideways by ${overflow}px at 360px`);

  /* ── What stayed out in the open ── */
  const outside = await page.evaluate(() => {
    const bar = document.querySelector("header")!;
    return [...bar.querySelectorAll("a,button")]
      .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 22))
      .filter(Boolean);
  });
  console.log(`  4. left in the open    → ${JSON.stringify(outside)}`);

  /* ── And what the menu holds ── */
  const trigger = page.getByRole("button", { name: /Hisob|Account|Аккаунт/ });
  if ((await trigger.count()) === 0) {
    failures.push("there is no account menu in the header");
  } else {
    await trigger.first().click();
    await page.waitForTimeout(500);

    const items = await page.evaluate(() => {
      const menu = document.querySelector('[role="menu"]');
      if (!menu) return null;
      return [...menu.querySelectorAll('[role="menuitem"]')].map((el) =>
        (el.textContent || "").trim(),
      );
    });
    console.log(`  5. inside the menu     → ${JSON.stringify(items)}`);

    if (!items) {
      failures.push("the account menu did not open");
    } else {
      const has = (re: RegExp) => items.some((i) => re.test(i));
      if (!has(/Sozlama|Settings|Настройк/)) failures.push("settings is not in the menu");
      if (!has(/Admin/)) failures.push("the admin link is not in the menu for an admin");
      if (!has(/Chiqish|Log out|Выход|Выйти/)) failures.push("log out is not in the menu");
      /* Headless Chrome fires no beforeinstallprompt, but the row is offered
         anyway — from a tab, installing is always possible. */
      if (!has(/oʻrnat|o'rnat|Install|Установ/i)) failures.push("install is not in the menu");
    }

    /* ── Install actually installs ──
       The head script catches `beforeinstallprompt` before React exists, so a
       prompt offered at any point is still in hand when the row is clicked.
       Without that the row fell back to explaining where Chrome hides its own
       menu item, which is not what a button labelled "install" should do. */
    await page.evaluate(`
      var e = new Event("beforeinstallprompt");
      window.__ahdPromptCalls = 0;
      e.prompt = function(){ window.__ahdPromptCalls++; return Promise.resolve(); };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    `);
    await page.waitForTimeout(500);

    await page
      .getByRole("menuitem", { name: /oʻrnat|o'rnat|Install|Установ/i })
      .first()
      .click();
    await page.waitForTimeout(600);

    const fired = await page.evaluate("window.__ahdPromptCalls || 0");
    console.log(`  6. clicking install   → prompt() called ${fired} time(s)`);
    if (Number(fired) < 1) {
      failures.push(
        "clicking install did not open the browser's install dialog — it fell back to explaining",
      );
    }

    /* Escape closes it. */
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const stillOpen = (await page.locator('[role="menu"]').count()) > 0;
    console.log(`  7. Escape closes it    → ${stillOpen ? "NO" : "yes"}`);
    if (stillOpen) failures.push("Escape does not close the account menu");
  }

  /* ── The name is shown on a laptop, where there is room ── */
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(600);
  const named = await page
    .getByRole("button", { name: /Hisob|Account|Аккаунт/ })
    .first()
    .innerText();
  console.log(`  8. at 1280px the trigger reads → "${named.replace(/\n/g, " ").trim()}"`);
  if (!/Abdulloh/.test(named)) failures.push("the account trigger does not show the name on a laptop");

  await browser.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
  console.log("\ntest account removed");

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("✓ the header fits a phone, and the account lives in one menu");
}

main().catch(async (error) => {
  console.error(error);
  await sql`delete from users where email like ${"%" + DOMAIN}`.catch(() => {});
  process.exit(1);
});
