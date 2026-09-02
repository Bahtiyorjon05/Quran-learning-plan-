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

  /* ── Download it ── */
  /* Wait for it rather than asking once: the panel is client-rendered, and a
     check that lands before hydration reports a missing button on a page that
     has one. */
  const download = page.getByRole("button", { name: /Yuklab olish|Download|Скачать/ });
  await download.first().waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});

  /* Visible is not the same as working. The panel is server-rendered, so the
     button exists in the HTML before React has attached anything to it, and a
     click that lands in that gap does nothing at all — which is exactly how
     this reported a download that never started. */
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(2000);

  if ((await download.count()) === 0) {
    failures.push("no way to download this surah for offline listening");
    await finish(browser);
    return;
  }

  await download.first().click();
  await page
    .getByText(/Yuklab olingan|Downloaded|Загружено/)
    .waitFor({ timeout: 60_000 })
    .catch(() => {});

  const savedLabel = await page
    .getByText(/Yuklab olingan|Downloaded|Загружено/)
    .textContent()
    .catch(() => null);
  console.log(`  4. downloaded      → ${savedLabel?.trim() ?? "NOTHING"}`);
  if (!savedLabel) failures.push("the download never reported itself as finished");

  const keptFiles = await page.evaluate(async () => {
    const cache = await caches.open("ahd-audio-saved");
    const keys = await cache.keys();
    return keys.filter((request) => request.url.endsWith(".mp3")).length;
  });
  console.log(`  5. files kept      → ${keptFiles}`);
  /* Four, not three: Al-Kawthar opens with the Basmala, and a download that
     leaves it out is silent from its very first request. */
  if (keptFiles < 4) {
    failures.push(
      `only ${keptFiles} files were kept; Al-Kawthar needs 3 ayahs and the Basmala`,
    );
  }

  /* ── Now take the network away and listen ── */
  await context.setOffline(true);
  console.log(`  6. network         → off`);

  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  const stillThere = await page.locator("[data-ayah]").count().catch(() => 0);
  console.log(`  7. page offline    → ${stillThere > 0 ? `${stillThere} ayahs` : "BLANK"}`);
  if (stillThere === 0) failures.push("the surah does not open at all with the network off");

  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });
  await page.locator("[data-recitation-toggle]").click().catch(() => {});
  await page.waitForTimeout(4000);

  const heard = await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (!el) return null;
    return { paused: el.paused, time: el.currentTime, error: el.error?.code ?? null };
  });
  console.log(
    `  8. recitation      → ${
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
