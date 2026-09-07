import { createHash, randomBytes } from "node:crypto";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { chromium } from "playwright-core";
config({ path: ".env.local", quiet: true });
const sql = neon(process.env.DATABASE_URL!);
const SITE = process.env.SITE ?? "http://localhost:3000";
const HOST = new URL(SITE).hostname;
const DOMAIN = "@sheet.ahd.test";
async function main() {
  const email = `s-${Date.now()}${DOMAIN}`;
  const [u] = (await sql`insert into users (email, email_verified_at, password_hash, display_name)
    values (${email}, now(), 'x', 'Aisha') returning id`) as { id: string }[];
  await sql`insert into profiles (user_id, locale, onboarded_at, time_zone, preferred_reciter, study_time)
    values (${u.id}, 'uz', now(), 'Asia/Tashkent', 'alafasy', '05:30')`;
  await sql`insert into plans (user_id, scope, scope_from_page, scope_to_page, total_lines, completed_lines,
      start_date, original_end_date, current_end_date, study_days_mask, rukhsah_budget, rukhsah_used, status)
    values (${u.id}, 'full', 1, 604, 9060, 0, now()::date,
      (now() + interval '603 days')::date, (now() + interval '603 days')::date, 127, 12, 0, 'active')`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into sessions (user_id, token_hash, expires_at)
    values (${u.id}, ${createHash("sha256").update(token).digest("hex")}, now() + interval '1 day')`;

  const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const [name, size] of [["phone", { width: 430, height: 860 }], ["laptop", { width: 1440, height: 900 }]] as const) {
    const ctx = await b.newContext({ viewport: size, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: "ahd_session", value: token, domain: HOST, path: "/", httpOnly: true, secure: SITE.startsWith("https"), sameSite: "Lax" }]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log("  PAGEERROR:", String(e).slice(0, 200)));
    p.on("console", (m) => console.log("  [browser]", m.text().slice(0, 160)));
    p.on("framenavigated", (f) => { if (f === p.mainFrame()) console.log("  NAVIGATED to", f.url()); });
    await p.goto(`${SITE}/app`, { waitUntil: "domcontentloaded" });
    await p.locator("li form button[type=submit]").first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(3500);
    console.log("  sheet says:", (await p.locator("li").first().innerText()).replace(/\s+/g, " ").slice(0, 120));
    const tick = p.locator("li form button[type=submit]").first();
    console.log(`  ${name}: tick buttons = ${await p.locator("li form button[type=submit]").count()}`);
    await tick.click();
    let ever = 0, everSky = 0;
    for (let i = 0; i < 70; i++) {
      await p.waitForTimeout(100);
      ever = Math.max(ever, await p.locator(".ahd-page-cheer").count());
      everSky = Math.max(everSky, await p.locator(".ahd-fall > i").count());
    }
    console.log(`  ${name}: ever card=${ever} ever motes=${everSky}`);
    const motes = await p.locator(".ahd-fall > i").count();
    const card = await p.locator(".ahd-page-cheer").count();
    console.log(`  ${name}: card=${card} motes=${motes}`);
    await p.screenshot({ path: `.logs/sheet-${name}.png` });
    /* And the reader's own Yodlangan button, on a page not yet held. */
    await p.goto(`${SITE}/app/quran/50`, { waitUntil: "domcontentloaded" });
    await p.locator("form button[aria-pressed]").first().waitFor({ timeout: 20000 });
    await p.waitForTimeout(2500);
    await p.locator("form button[aria-pressed]").first().click();
    let readerCard = 0, readerSky = 0;
    for (let i = 0; i < 30; i++) {
      await p.waitForTimeout(60);
      readerCard = Math.max(readerCard, await p.locator(".ahd-page-cheer").count());
      readerSky = Math.max(readerSky, await p.locator(".ahd-fall > i").count());
    }
    console.log(`  ${name}: READER card=${readerCard} motes=${readerSky}`);
    await p.screenshot({ path: `.logs/reader-${name}.png` });
    const units = (await sql`select page from memorization_units where user_id = ${u.id} order by page`) as { page: number }[];
    console.log(`  ${name}: pages in db = [${units.map((r) => r.page).join(",")}]`);
    await sql`delete from memorization_units where user_id = ${u.id}`;
    await sql`delete from plan_days where plan_id in (select id from plans where user_id = ${u.id})`;
    await ctx.close();
  }
  await b.close();
  await sql`delete from users where email like ${"%" + DOMAIN}`;
}
main();
