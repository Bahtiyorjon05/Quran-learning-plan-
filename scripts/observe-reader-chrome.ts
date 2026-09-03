/**
 * Checks that the reader gets out of the way, and that the player does not.
 *
 * Scrolling down through a page of the Qur'an should take the bars with it —
 * the wordmark, the language buttons, the surah name, the page arrows — and
 * scrolling back up should bring them straight back. The player stays either
 * way, because pause and repeat are wanted *while* reading.
 *
 * Measured as a person would see it: where the bars actually are on screen,
 * not whether an attribute was written.
 *
 *   npm run observe:reader:chrome
 */
import { chromium, type Page } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

const failures: string[] = [];

/** Where the top bar sits relative to the viewport, in pixels. */
async function headerBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const header = document.querySelector("[data-chrome-hide]");
    return header ? Math.round(header.getBoundingClientRect().bottom) : NaN;
  });
}

async function playerTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const player = document.querySelector(".reader-player");
    return player ? Math.round(player.getBoundingClientRect().top) : NaN;
  });
}

/** Scroll the way a finger does, so a direction-watching listener sees it. */
async function scrollBy(page: Page, amount: number) {
  await page.evaluate((by) => window.scrollBy({ top: by, behavior: "instant" }), amount);
  await page.waitForTimeout(500);
}

async function check(page: Page, path: string, label: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".reader-player", { timeout: 20_000 });
  await page.waitForTimeout(600);

  const restingHeader = await headerBottom(page);
  const restingPlayer = await playerTop(page);
  console.log(`\n  ${label} (${path})`);
  console.log(`    at rest      → bar ends at ${restingHeader}px, player at ${restingPlayer}px`);

  if (!(restingHeader > 0)) {
    failures.push(`${label}: the bar is not visible before any scrolling`);
    return;
  }

  /* Down, well past the threshold. */
  await scrollBy(page, 400);
  await scrollBy(page, 400);

  const goneHeader = await headerBottom(page);
  const gonePlayer = await playerTop(page);
  console.log(`    scrolled down → bar ends at ${goneHeader}px, player at ${gonePlayer}px`);

  if (goneHeader >= restingHeader) {
    failures.push(`${label}: the bar did not move out of the way when reading down`);
  }
  if (!(gonePlayer >= 0 && gonePlayer < 120)) {
    failures.push(
      `${label}: the player should stay near the top while reading, but sits at ${gonePlayer}px`,
    );
  }

  /* And back up. */
  await scrollBy(page, -300);

  const backHeader = await headerBottom(page);
  console.log(`    scrolled up   → bar ends at ${backHeader}px`);
  if (backHeader <= goneHeader) {
    failures.push(`${label}: the bar did not come back when scrolling up`);
  }
}

async function main() {
  console.log(BASE);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const page = await (await browser.newContext({ viewport: { width: 420, height: 820 } })).newPage();
  page.setDefaultTimeout(20_000);

  await check(page, "/quran/3", "the page reader");
  await check(page, "/quran/surah/2", "a whole surah");

  /* And nowhere else: leaving the reader must not leave the site headless. */
  await page.goto(`${BASE}/about`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);
  const leaked = await page.evaluate(() => document.documentElement.dataset.chrome ?? "none");
  console.log(`\n  after leaving the reader → data-chrome is "${leaked}"`);
  if (leaked !== "none") {
    failures.push(`the reader left data-chrome="${leaked}" behind on the rest of the site`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ the bars step aside while reading, the player stays, and nothing leaks");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
