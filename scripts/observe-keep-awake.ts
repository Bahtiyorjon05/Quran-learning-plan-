/**
 * The screen does not go dark while the mushaf is open.
 *
 * A wake lock is invisible by nature — there is nothing on the page to look at
 * and nothing in the DOM to assert against — so the browser's own API is
 * instrumented before the page loads and asked afterwards what happened. That
 * catches the three ways this feature fails quietly:
 *
 *   · never requested at all on a reading screen;
 *   · requested, then never re-taken after the page was hidden, which is when
 *     the browser drops it — so the screen sleeps for the rest of the session;
 *   · still held after leaving the reader, which is how an app eats a battery.
 *
 *   npm run observe:keep-awake
 */
import { chromium } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

const failures: string[] = [];

/* Replaces the real API with one that records. The real one needs a focused,
   visible window and would make this depend on the machine running it. */
const INSTRUMENT = `
  (() => {
    const log = { requests: 0, released: 0, held: 0 };
    window.__wake = log;
    const make = () => {
      const listeners = [];
      const sentinel = {
        released: false,
        /* Drop it the way a browser does when the page is hidden: mark it
           spent, and only then tell anybody who asked. */
        drop: (announce) => {
          if (sentinel.released) return;
          sentinel.released = true;
          log.released++;
          log.held--;
          if (announce) for (const fn of listeners) fn();
        },
        addEventListener: (_t, fn) => listeners.push(fn),
        release: async () => {
          if (sentinel.released) return;
          sentinel.released = true;
          log.released++;
          log.held--;
          for (const fn of listeners) fn();
        },
      };
      return sentinel;
    };
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async (type) => {
          if (document.visibilityState !== "visible") throw new Error("not visible");
          log.requests++;
          log.held++;
          log.type = type;
          return (log.last = make());
        },
      },
    });
  })();
`;

async function read(page: import("playwright-core").Page) {
  return page.evaluate("window.__wake") as Promise<Record<string, number>>;
}

async function main() {
  console.log(`${BASE}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await context.addInitScript(INSTRUMENT);
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);

  /* ── 1. A reading page takes the lock ── */
  await page.goto(`${BASE}/quran/42`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]", { timeout: 20_000 });
  await page.waitForTimeout(1200);

  let wake = await read(page);
  console.log(`  1. opening a page  → ${wake.requests} request(s), holding ${wake.held}`);
  if (wake.requests < 1) failures.push("the reader never asked to keep the screen awake");
  if (wake.held !== 1) failures.push(`the reader holds ${wake.held} locks, expected exactly 1`);

  /* ── 2. Hidden and shown again, it asks a second time ──
     The browser releases the lock on its own when the page is hidden, and
     hands nothing back on return. Without this, the screen sleeps forever
     after the first phone call. */
  await page.evaluate(`
    Object.defineProperty(document, "visibilityState", { configurable: true, get: function(){ return "hidden"; } });
    /* The unkind ordering: the browser takes the lock back without the release
       event having been delivered yet. Code that trusts its own reference
       instead of asking whether the lock is spent never recovers from this. */
    window.__wake.last.drop(false);
    document.dispatchEvent(new Event("visibilitychange"));
  `);
  await page.waitForTimeout(400);
  await page.evaluate(`
    Object.defineProperty(document, "visibilityState", { configurable: true, get: function(){ return "visible"; } });
    document.dispatchEvent(new Event("visibilitychange"));
  `);
  await page.waitForTimeout(600);

  wake = await read(page);
  console.log(`  2. hidden, then back → ${wake.requests} request(s) total, holding ${wake.held}`);
  if (wake.requests < 2) {
    failures.push("coming back to the page did not re-take the lock the browser had dropped");
  }

  /* ── 3. A whole surah keeps it too ── */
  await page.goto(`${BASE}/quran/surah/36`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah]", { timeout: 20_000 });
  await page.waitForTimeout(1200);
  wake = await read(page);
  console.log(`  3. a whole surah   → ${wake.requests} request(s), holding ${wake.held}`);
  if (wake.requests < 1) failures.push("reading a whole surah does not keep the screen awake");

  /* ── 4. And leaving lets it go ── */
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  wake = await read(page);
  console.log(`  4. away from the mushaf → ${wake.requests} request(s), holding ${wake.held}`);
  if (wake.requests !== 0) {
    failures.push("a page that is not the mushaf asked to keep the screen awake");
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ the screen is held awake while reading, re-taken after a hide, and let go on the way out");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
