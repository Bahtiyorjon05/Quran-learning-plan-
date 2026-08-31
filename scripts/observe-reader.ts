/**
 * Checks the reader in a real browser: that names switch language, and that
 * recitation actually plays.
 *
 * Both are things the type checker cannot see. A surah name is only wrong once
 * it is rendered next to Uzbek prose, and an audio URL is only right if the
 * file at the other end exists — which no unit test can know.
 *
 *   npm run observe:reader
 */
import { chromium, type Page } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

/** Al-Baqara opens on page 2, so every language has the same surah to name. */
const EXPECTED = [
  { prefix: "", language: "Uzbek", name: "Baqara", gloss: "Sigir" },
  { prefix: "/en", language: "English", name: "Al-Baqara", gloss: "The Cow" },
  { prefix: "/ru", language: "Russian", name: "Аль-Бакара", gloss: "Корова" },
] as const;

const failures: string[] = [];

async function heading(page: Page): Promise<string> {
  return (await page.locator("header").filter({ hasText: /Baqara|Бакара/ }).first().innerText())
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`${BASE}\n`);

  /* ── The names, in each language ── */
  for (const { prefix, language, name, gloss } of EXPECTED) {
    await page.goto(`${BASE}${prefix}/quran/2`, { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();

    const hasName = body.includes(name);
    const hasGloss = body.includes(gloss);
    console.log(`  ${language.padEnd(8)} ${hasName ? "✓" : "✗"} ${name}   ${hasGloss ? "✓" : "✗"} ${gloss}`);

    if (!hasName) failures.push(`${language}: the page never says "${name}"`);
    if (!hasGloss) failures.push(`${language}: the page never says "${gloss}"`);

    /* And it must not be showing another language's name at the same time. */
    for (const other of EXPECTED) {
      if (other.language === language) continue;
      /* "Al-Baqara" contains "Baqara", so only the unambiguous ones are checked. */
      if (other.gloss !== gloss && body.includes(other.gloss)) {
        failures.push(`${language}: also shows the ${other.language} gloss "${other.gloss}"`);
      }
    }
  }

  /* ── The recitation ── */
  console.log("");
  await page.goto(`${BASE}/quran/2`, { waitUntil: "networkidle" });

  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/quran/audio/")) requested.push(r.url());
  });

  const play = page.getByRole("button", { name: /Tinglash|Play|Слушать/ }).first();
  if ((await play.count()) === 0) {
    failures.push("no play button on the reader");
  } else {
    await play.click();
    await page.waitForTimeout(2500);

    if (requested.length === 0) {
      failures.push("pressing play requested no audio");
    } else {
      const url = requested[0];
      console.log(`  requested ${url.replace("https://cdn.islamic.network/quran/audio/", "")}`);

      /* Page 2 opens at 2:1, which is ayah 8 of the whole Qur'an. If the
         numbering is off, this plays the wrong verse of the Qur'an. */
      if (!url.endsWith("/8.mp3")) {
        failures.push(`play started at ${url.split("/").pop()} rather than ayah 8 (2:1)`);
      }

      const response = await page.request.get(url);
      console.log(`  the file itself → ${response.status()}`);
      if (!response.ok()) failures.push(`the audio URL returned ${response.status()}`);

      /* And the ayah being recited must be marked in the text. */
      const marked = await page.locator("[data-reciting]").count();
      console.log(`  marked in the text → ${marked === 1 ? "✓" : `✗ (${marked} nodes)`}`);
      if (marked !== 1) failures.push(`${marked} ayahs marked as reciting, expected 1`);
    }
  }

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} failures:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ names follow the language, and the recitation plays");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
