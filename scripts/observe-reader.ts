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
    /* Long enough for the Basmala to finish and the ayah after it to be
       asked for — the whole point of the check below. */
    await page.waitForTimeout(9000);

    if (requested.length === 0) {
      failures.push("pressing play requested no audio");
    } else {
      const url = requested[0];
      console.log(`  requested ${url.replace("https://cdn.islamic.network/quran/audio/", "")}`);

      /* Page 2 opens Al-Baqara, so the Basmala is asked for first and the ayah
         follows it. Both are checked: the Basmala is global ayah 1, and 2:1 is
         ayah 8 — if that numbering is off, the wrong verse of the Qur'an
         plays. */
      const second = requested[1] ?? "";
      if (!url.endsWith("/1.mp3")) {
        failures.push(`play started at ${url.split("/").pop()} rather than the Basmala`);
      } else if (!second.endsWith("/8.mp3")) {
        failures.push(
          `after the Basmala it played ${second.split("/").pop() || "nothing"} rather than ayah 8 (2:1)`,
        );
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

  /* ── The Qur'an is set in the face drawn for it ── */
  const face = await page.evaluate(() => {
    const ayah = document.querySelector("[data-ayah] p[lang='ar']");
    if (!ayah) return null;
    const family = getComputedStyle(ayah).fontFamily;
    /* Loaded, not merely named: a family that never arrived falls back
       silently and the marks land in the wrong place. */
    const loaded = [...document.fonts].some(
      (f) => /Amiri Quran/i.test(f.family) && f.status === "loaded",
    );
    return { family, loaded };
  });
  console.log(`  qur'an face: ${face?.family?.split(",")[0] ?? "none"} (loaded: ${face?.loaded})`);
  if (!face || !/Amiri.?Quran/i.test(face.family)) {
    failures.push(`the Qur'an is not set in Amiri Quran (${face?.family ?? "no ayah found"})`);
  }

  /* ── The page follows the recitation ── */
  console.log("");
  await page.goto(`${BASE}/quran/2`, { waitUntil: "networkidle" });
  await page.evaluate(() => window.scrollTo(0, 0));

  const play2 = page.getByRole("button", { name: /Tinglash|Play|Слушать/ }).first();
  await play2.click();
  await page.waitForTimeout(1200);

  const before = await page.evaluate(() => window.scrollY);
  /* Jump several ayahs down the page; the scroll must catch up. */
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: /Keyingi oyat|Next ayah|Следующий аят/ }).first().click();
    await page.waitForTimeout(700);
  }
  const after = await page.evaluate(() => window.scrollY);

  console.log(`  scrolled while playing: ${before} → ${after}`);
  if (after <= before) {
    failures.push("the page did not scroll to follow the recitation");
  }

  const stillMarked = await page.locator("[data-reciting]").count();
  if (stillMarked !== 1) failures.push(`${stillMarked} ayahs marked after skipping, expected 1`);

  /* ── Seek and speed ── */
  const seek = await page.locator("input.ahd-seek").count();
  console.log(`  seek bar while playing: ${seek === 1 ? "✓" : "✗"}`);
  if (seek !== 1) failures.push("no seek bar appeared once something was playing");

  await page.getByRole("button", { name: "0.5×" }).click();
  await page.waitForTimeout(400);
  const rate = await page.evaluate(() => document.querySelector("audio")?.playbackRate);
  console.log(`  playback rate after choosing 0.5×: ${rate}`);
  if (rate !== 0.5) failures.push(`speed did not apply (rate is ${rate})`);

  /* ── Reaching the end marks the page read ── */
  console.log("");
  await page.goto(`${BASE}/quran/3`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("ahd-pages-read"));
  await page.reload({ waitUntil: "networkidle" });

  const readBefore = await page.evaluate(() => localStorage.getItem("ahd-pages-read"));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const readAfter = await page.evaluate(() => localStorage.getItem("ahd-pages-read"));

  console.log(`  read marker: ${readBefore ?? "none"} → ${readAfter ?? "none"}`);
  if (!readAfter?.includes("3")) {
    failures.push("scrolling to the end did not mark the page read");
  }

  const notice = await page.getByText(/belgilandi|Marked as read|Отмечено как/).count();
  console.log(`  told the reader: ${notice > 0 ? "✓" : "✗"}`);
  if (notice === 0) failures.push("the page was marked read without saying so");

  /* ── The surah-only reciter is honest about what it cannot do ── */
  console.log("");
  const badr = page.getByRole("button", { name: /Badr|Бадр/ }).first();
  if ((await badr.count()) === 0) {
    failures.push("Badr al-Turki is not offered");
  } else {
    await badr.click();
    await page.waitForTimeout(400);
    const repeat = await page
      .getByRole("button", { name: /takrorlash|Repeat this ayah|Повторять этот аят/ })
      .count();
    const note = await page.getByText(/butun sura|whole surah|вся сура/i).count();
    console.log(`  Badr al-Turki: repeat hidden ${repeat === 0 ? "✓" : "✗"}, note shown ${note > 0 ? "✓" : "✗"}`);
    if (repeat !== 0) failures.push("ayah repeat is offered for a surah-only reciter");
    if (note === 0) failures.push("nothing tells the reader this reciter cannot follow along");
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
