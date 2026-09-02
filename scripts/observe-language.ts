/**
 * Checks that changing language changes the language, and nothing else.
 *
 * Switching locale is a route change, and a route change unmounts everything
 * under it. That is invisible until something is running: the recitation used
 * to stop dead halfway through an ayah, which made a language button feel like
 * a page reload. Nothing about choosing Russian should silence the Qur'an.
 *
 * Four things are asserted here, and the first two are the ones that regress:
 * the audio keeps playing and keeps its place, the document is not reloaded,
 * the page really is in the new language, and the URL carries the right prefix.
 *
 *   npm run observe:language
 */
import { chromium } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

const failures: string[] = [];

type AudioState = { paused: boolean; time: number; src: string } | null;

async function main() {
  console.log(`${BASE}\n`);

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  /* Nothing here may hang: every wait is bounded so a missing control fails
     loudly rather than sitting there. */
  page.setDefaultTimeout(15_000);

  await page.goto(`${BASE}/quran/2`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("audio", { state: "attached", timeout: 15_000 });
  console.log("  0. reader opened");

  /* A marker on `window` survives a client-side navigation and dies in a full
     document load — which is the difference between "the language changed" and
     "the page reloaded". */
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).__ahdAlive = "yes";
  });

  const readAudio = (): Promise<AudioState> =>
    page.evaluate(() => {
      const el = document.querySelector("audio");
      if (!el) return null;
      return { paused: el.paused, time: el.currentTime, src: el.currentSrc.slice(-24) };
    });

  /* Muted, because nothing needs to be heard to be measured — and started by
     clicking the real control, because a scripted play() is not what a person
     does and crashed the tab besides. */
  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });
  await page.locator("[data-recitation-toggle]").click();
  await page.waitForTimeout(4000);

  const before = await readAudio();
  console.log(`  1. reciting        → ${before?.paused === false ? `yes, at ${before.time.toFixed(1)}s` : "NOT PLAYING"}`);
  if (!before || before.paused) {
    failures.push("the recitation never started, so the rest of this proves nothing");
    await finish(browser);
    return;
  }

  const uzText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  const uzLang = await page.evaluate(() => document.documentElement.lang);

  /* ── The switch ── */
  await page.getByRole("button", { name: "English" }).click();
  await page.waitForTimeout(2500);

  const after = await readAudio();
  const alive = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).__ahdAlive ?? "gone",
  );
  const enLang = await page.evaluate(() => document.documentElement.lang);
  const enText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  const url = new URL(page.url()).pathname;

  console.log(`  2. document        → ${alive === "yes" ? "not reloaded" : "RELOADED"}`);
  if (alive !== "yes") failures.push("switching language reloads the whole document");

  console.log(`  3. url             → ${url}`);
  if (url !== "/en/quran/2") failures.push(`the switch landed on ${url}, not /en/quran/2`);

  console.log(`  4. html lang       → ${uzLang} → ${enLang}`);
  if (enLang === uzLang) failures.push("the document language did not change");

  console.log(`  5. page text       → ${uzText === enText ? "UNCHANGED" : "translated"}`);
  if (uzText === enText) failures.push("the words on the page did not change language");

  console.log(
    `  6. recitation      → ${
      after ? (after.paused ? "STOPPED" : `still playing, at ${after.time.toFixed(1)}s`) : "ELEMENT GONE"
    }`,
  );
  if (!after) failures.push("the audio element did not survive the switch");
  else if (after.paused) failures.push("switching language stopped the recitation");
  else if (after.time < before.time) {
    failures.push(
      `the recitation restarted: it was at ${before.time.toFixed(1)}s and is now at ${after.time.toFixed(1)}s`,
    );
  }

  /* ── And back again, because one direction proving out is not the feature ── */
  await page.getByRole("button", { name: /zbek/i }).first().click();
  await page.waitForTimeout(2500);

  const back = await readAudio();
  const backUrl = new URL(page.url()).pathname;
  console.log(
    `  7. and back to uz  → ${backUrl}, ${back && !back.paused ? `still playing at ${back.time.toFixed(1)}s` : "STOPPED"}`,
  );
  if (backUrl !== "/quran/2") failures.push(`switching back landed on ${backUrl}, not /quran/2`);
  if (!back || back.paused) failures.push("switching back stopped the recitation");

  await finish(browser);
}

async function finish(browser: { close: () => Promise<void> }) {
  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ the language changes and the recitation does not");
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
