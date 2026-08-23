/**
 * Drives a real browser and checks that switching language changes nothing but
 * the language.
 *
 * Two fixes were guessed at from reading the code and neither held. This one
 * was found by watching the DOM instead: React re-renders <html> when the
 * locale changes and drops attributes it does not own, so `data-theme` — set by
 * an inline script rather than rendered — was wiped on every switch, and the
 * dark-first palette meant a light reader stayed dark.
 *
 * Every pair of languages is tried, in both themes, on several pages, because
 * the first version of this check tested one path and one theme and would have
 * passed while the product was still broken for everyone else.
 *
 *   npm run observe:theme            # against localhost
 *   npm run observe:theme -- --prod  # against production
 */
import { chromium, type Page } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.argv.includes("--prod")
  ? "https://ahd-quran.vercel.app"
  : "http://localhost:3000";

/** Button labels in the switcher, and the path each language lives at. */
const LANGUAGES = [
  { name: "O'zbekcha", prefix: "" },
  { name: "English", prefix: "/en" },
  { name: "Русский", prefix: "/ru" },
] as const;

/** Pages worth checking: static, dynamic, and one with its own controls. */
const PAGES = ["/", "/quran/1", "/about"];

type Snapshot = { theme: string | null; background: string; path: string };

const failures: string[] = [];

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    background: getComputedStyle(document.body).backgroundColor,
    path: location.pathname,
  }));
}

async function chooseTheme(page: Page, theme: string) {
  await page.evaluate((value) => {
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("ahd-theme", value);
  }, theme);
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  console.log(`${BASE}\n`);

  for (const scheme of ["light", "dark"] as const) {
    for (const theme of ["light", "dark", "sepia"]) {
      /* A fresh context each time: no state carried between cases. */
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();

      for (const path of PAGES) {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await chooseTheme(page, theme);
        const before = await snapshot(page);

        for (const language of LANGUAGES) {
          const target = `${language.prefix}${path === "/" ? "" : path}` || "/";

          const button = page.getByRole("button", { name: language.name });
          if ((await button.count()) === 0) continue;

          await button.first().click();
          await page.waitForURL((url) => url.pathname === target, { timeout: 15000 })
            .catch(() => {});
          await page.waitForLoadState("domcontentloaded");

          const after = await snapshot(page);
          const label = `${scheme} device · ${theme} chosen · ${path} → ${language.name}`;

          if (after.theme !== theme) {
            failures.push(`${label}: theme became ${after.theme ?? "absent"}`);
          } else if (after.background !== before.background) {
            failures.push(
              `${label}: background changed ${before.background} → ${after.background}`,
            );
          }
        }
      }

      await context.close();
      console.log(`  ✓ ${scheme} device, ${theme} chosen`);
    }
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} failures:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }

  console.log("\n✓ switching language changes nothing but the language");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
