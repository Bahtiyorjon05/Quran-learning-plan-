/**
 * Checks how a recitation begins, and that any verse can be asked for.
 *
 * Every surah but At-Tawbah opens with the Basmala, and in all of them except
 * Al-Fatiha it is not a numbered ayah — so the audio file for ayah 1 starts at
 * the first word of the surah and the opening is simply missing. No reciter
 * begins that way. This walks the three cases that matter and checks the
 * player asks for the right file first:
 *
 *   Al-Baqara   the Basmala, then the ayah
 *   At-Tawbah   the ayah, with no Basmala — the exception the tradition makes
 *   Al-Fatiha   the ayah, because its first ayah already is the words
 *
 * It also checks the control beside each verse starts that verse, which is the
 * whole point of putting it there.
 *
 *   npm run observe:recitation
 */
import { chromium, type Page } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

/** Al-Fatiha 1:1 is the Basmala, so its audio file is global ayah 1. */
const BASMALA_FILE = "/1.mp3";

const failures: string[] = [];

/** The file the player asks for first, after pressing play on a page. */
async function firstRequest(page: Page, path: string): Promise<string> {
  const asked: string[] = [];
  const listen = (url: string) => {
    if (/cdn\.islamic\.network.*\.mp3$/.test(url)) asked.push(new URL(url).pathname);
  };
  page.on("request", (r) => listen(r.url()));

  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-recitation-toggle]", { timeout: 15_000 });
  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });
  await page.locator("[data-recitation-toggle]").click();
  await page.waitForTimeout(3000);

  page.removeAllListeners("request");
  return asked[0] ?? "(nothing was requested)";
}

async function main() {
  console.log(`${BASE}\n`);

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);

  /* ── Al-Baqara: the Basmala comes first ── */
  const baqara = await firstRequest(page, "/quran/2");
  const baqaraOk = baqara.endsWith(BASMALA_FILE);
  console.log(`  1. Al-Baqara       → asks for ${baqara} ${baqaraOk ? "(the Basmala)" : ""}`);
  if (!baqaraOk) {
    failures.push(`Al-Baqara began with ${baqara} rather than the Basmala`);
  }

  /* ── At-Tawbah: no Basmala, and this one matters ── */
  const tawbah = await firstRequest(page, "/quran/187");
  const tawbahOk = !tawbah.endsWith(BASMALA_FILE);
  console.log(`  2. At-Tawbah       → asks for ${tawbah} ${tawbahOk ? "(no Basmala, correct)" : ""}`);
  if (!tawbahOk) {
    failures.push("At-Tawbah was given a Basmala, which it does not have");
  }

  /* ── Al-Fatiha: its first ayah already is the Basmala ── */
  const fatiha = await firstRequest(page, "/quran/1");
  console.log(`  3. Al-Fatiha       → asks for ${fatiha}`);
  if (!fatiha.endsWith(BASMALA_FILE)) {
    failures.push(`Al-Fatiha began with ${fatiha}, not its own first ayah`);
  }

  /* ── The Basmala is lit while it is the thing being recited ── */
  await page.goto(`${BASE}/quran/2`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-recitation-toggle]", { timeout: 15_000 });
  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });
  await page.locator("[data-recitation-toggle]").click();
  await page.waitForTimeout(2500);

  const litDuringBasmala = await page.evaluate(() => {
    const marked = document.querySelector("[data-reciting]");
    if (!marked) return "nothing";
    return marked.hasAttribute("data-basmala")
      ? `basmala of surah ${marked.getAttribute("data-basmala")}`
      : `ayah ${marked.getAttribute("data-ayah")}`;
  });
  console.log(`  6. while the Basmala sounds → ${litDuringBasmala} is lit`);
  if (!litDuringBasmala.startsWith("basmala")) {
    failures.push(
      `the Basmala was sounding but ${litDuringBasmala} was lit — the page marks a verse that is not being recited yet`,
    );
  }

  /* ── The control beside a verse starts that verse ── */
  await page.goto(`${BASE}/quran/3`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-ayah-play]", { timeout: 15_000 });

  const buttons = await page.locator("[data-ayah-play]").count();
  console.log(`  4. per-verse plays → ${buttons} on the page`);
  if (buttons === 0) failures.push("no verse has a way to be played on its own");

  await page.evaluate(() => {
    const el = document.querySelector("audio");
    if (el) el.muted = true;
  });

  const wanted = await page.locator("[data-ayah-play]").nth(2).getAttribute("data-ayah-play");
  await page.locator("[data-ayah-play]").nth(2).click();
  await page.waitForTimeout(2500);

  const reciting = await page.evaluate(
    () => document.querySelector("[data-reciting]")?.getAttribute("data-ayah") ?? "(none)",
  );
  console.log(`  5. asked for ${wanted}  → reciting ${reciting}`);
  if (reciting !== wanted) {
    failures.push(`pressing play on ${wanted} started ${reciting}`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ every surah opens as it should, and any verse can be asked for");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
