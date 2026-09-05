/**
 * Reading a whole surah or juz, and hearing it with the network off.
 *
 * "Works offline" is the kind of claim that is easy to make and easy to get
 * wrong, so it is not asserted here — it is done. A short surah is downloaded
 * through the real button, the browser is genuinely put offline, and the
 * recitation is played. If it makes a sound with the network down, it works.
 *
 * Al-Kawthar is used because it is three ayahs: enough to prove the mechanism,
 * small enough to be kind to the CDN on every run.
 *
 *   npm run observe:offline
 */
import { chromium } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

const failures: string[] = [];

async function main() {
  console.log(`${BASE}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  /* ── Reading a whole surah ── */
  await page.goto(`${BASE}/quran/surah/2`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]", { timeout: 20_000 });
  const baqara = await page.locator("[data-ayah]").count();
  console.log(`  1. Al-Baqara whole → ${baqara} ayahs on one page`);
  if (baqara !== 286) failures.push(`Al-Baqara rendered ${baqara} ayahs, not 286`);

  /* ── Reading a whole juz ── */
  await page.goto(`${BASE}/quran/juz/30`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]", { timeout: 20_000 });
  const juz30 = await page.locator("[data-ayah]").count();
  console.log(`  2. Juz 30 whole    → ${juz30} ayahs on one page`);
  if (juz30 !== 564) failures.push(`Juz 30 rendered ${juz30} ayahs, not 564`);

  /* ── The service worker has to be running for any of the rest ── */
  await page.goto(`${BASE}/quran/surah/108`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    undefined,
    { timeout: 25_000 },
  ).catch(() => {});

  const controlled = await page.evaluate(() => navigator.serviceWorker?.controller != null);
  console.log(`  3. service worker  → ${controlled ? "in control" : "NOT IN CONTROL"}`);
  if (!controlled) {
    failures.push("the service worker never took control, so nothing can be kept offline");
    await finish(browser);
    return;
  }

  /* ── Download a whole surah, not just the page in front of us ── */
  await page.goto(`${BASE}/quran/582`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]", { timeout: 20_000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  /* Keeping a surah is asked for about once per surah, so it sits with the
     player's other settings rather than above the words on every visit. Open
     them the way a reader would. */
  await page.getByRole("button", { name: /Sozlamalar|Options|Настройки/ }).first().click();
  await page.waitForTimeout(500);

  const surahScope = page.getByRole("button", { name: /This surah|Bu sura|Эта сура/ });
  const hasScopes = (await surahScope.count()) > 0;
  console.log(`  4. scope chooser   → ${hasScopes ? "page, surah and juz offered" : "MISSING"}`);
  if (!hasScopes) {
    failures.push("there is no way to download more than the page in front of you");
    await finish(browser);
    return;
  }
  await surahScope.first().click();
  await page.waitForTimeout(300);

  const download = page.getByRole("button", { name: /Yuklab olish|Download|Скачать/ });
  await download.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  await download.first().click();

  await page
    .getByText(/Yuklab olingan|Downloaded|Загружено/)
    .waitFor({ timeout: 120_000 })
    .catch(() => {});

  const savedLabel = await page
    .getByText(/Yuklab olingan|Downloaded|Загружено/)
    .textContent()
    .catch(() => null);
  console.log(`  5. downloaded      → ${savedLabel?.trim() ?? "NOTHING"}`);
  if (!savedLabel) failures.push("the download never reported itself as finished");

  const kept = await page.evaluate(async () => {
    const cache = await caches.open("ahd-audio-saved");
    const keys = await cache.keys();
    return {
      audio: keys.filter((r) => r.url.endsWith(".mp3")).length,
      pages: keys.filter((r) => /\/quran\/\d+$/.test(new URL(r.url).pathname)).length,
    };
  });
  console.log(`  6. kept            → ${kept.audio} recitations, ${kept.pages} pages`);
  if (kept.audio < 40) failures.push(`only ${kept.audio} recitations kept; An-Naba has 40 ayahs`);
  if (kept.pages < 2) {
    failures.push(
      `only ${kept.pages} page(s) kept — a surah downloaded without its pages can be heard but not read`,
    );
  }

  /* ── Now take the network away ── */
  await context.setOffline(true);
  console.log(`  7. network         → off`);

  /* The page it was downloaded from, refreshed. */
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  const here = await page.locator("[data-ayah]").count().catch(() => 0);
  console.log(`  8. same page       → ${here > 0 ? `${here} ayahs` : "BLANK"}`);
  if (here === 0) failures.push("the downloaded page does not open with the network off");

  /* And the page it carries on to, which was never opened online. This is the
     one that was broken: audio was kept and the text was not. */
  await page.goto(`${BASE}/quran/583`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1500);
  const unseen = await page.locator("[data-ayah]").count().catch(() => 0);
  console.log(`  9. a page never opened → ${unseen > 0 ? `${unseen} ayahs` : "BLANK"}`);
  if (unseen === 0) {
    failures.push("a downloaded page that had never been visited does not open offline");
  }

  /* And the journey a reader actually takes offline: open the index of surahs
     — which is precached, so it works — and tap the surah they downloaded.
     That lands on a different address from any single page, and keeping only
     the pages left this step showing the offline notice instead of the words. */
  await page.goto(`${BASE}/quran`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1200);
  const indexWorks = (await page.locator("a[href*='/quran/']").count().catch(() => 0)) > 0;
  console.log(` 10. surah index offline → ${indexWorks ? "opens" : "BLANK"}`);
  if (!indexWorks) failures.push("the index of surahs does not open offline");

  await page.goto(`${BASE}/quran/surah/78`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForTimeout(1500);
  const surahOffline = await page.locator("[data-ayah]").count().catch(() => 0);
  console.log(` 11. the surah, read whole → ${surahOffline > 0 ? `${surahOffline} ayahs` : "BLANK"}`);
  if (surahOffline !== 40) {
    failures.push(
      `tapping the downloaded surah offline showed ${surahOffline} ayahs, expected An-Naba's 40`,
    );
  }

  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });
  await page.locator("[data-recitation-toggle]").click().catch(() => {});
  await page.waitForTimeout(4000);

  const heard = await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (!el) return null;
    return { paused: el.paused, time: el.currentTime };
  });
  console.log(
    ` 10. recitation      → ${
      heard && !heard.paused && heard.time > 0
        ? `playing offline, at ${heard.time.toFixed(1)}s`
        : `SILENT ${JSON.stringify(heard)}`
    }`,
  );
  if (!heard || heard.paused || heard.time <= 0) {
    failures.push("a downloaded surah does not play with the network off");
  }

  await context.setOffline(false);
  await finish(browser);
}

async function finish(browser: { close: () => Promise<void> }) {
  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ a surah and a juz read whole, and a download plays with the network off");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
