/**
 * Checks the things that only exist in a browser: the service worker, the
 * install offer, and whether the prose pages actually got their contents rail.
 *
 *   npm run observe:pwa
 */
import { chromium } from "playwright-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";

const failures: string[] = [];

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`${BASE}\n`);

  /* ── The worker registers, and takes control ── */
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const worker = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return "none";
    return registration.active ? "active" : registration.installing ? "installing" : "waiting";
  });
  console.log(`  service worker: ${worker}`);
  if (worker !== "active" && worker !== "installing" && worker !== "waiting") {
    failures.push(`the service worker did not register (${worker})`);
  }

  /* ── What it cached ── */
  await page.waitForTimeout(1500);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const counts: Record<string, number> = {};
    for (const name of names) counts[name] = (await (await caches.open(name)).keys()).length;
    return counts;
  });
  console.log(`  caches: ${JSON.stringify(cached)}`);
  if (Object.keys(cached).length === 0) failures.push("the worker cached nothing at all");

  /* ── The install offer draws nothing where it cannot act ──
     Headless Chrome fires no beforeinstallprompt and is not Safari, so the
     component should be absent entirely rather than an empty box. */
  const offerOnHome = await page.getByText(/Ahd ilovasini|Install Ahd|Установите Ahd/).count();
  console.log(`  install offer where it cannot install: ${offerOnHome === 0 ? "absent ✓" : "present ✗"}`);
  if (offerOnHome !== 0) {
    failures.push("the install offer rendered in a browser that cannot install");
  }

  /* ── And it appears once the browser says it can ── */
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.waitForTimeout(400);
  const offerAfter = await page.getByText(/Ahd ilovasini|Install Ahd|Установите Ahd/).count();
  console.log(`  install offer once the browser offers: ${offerAfter > 0 ? "shown ✓" : "missing ✗"}`);
  if (offerAfter === 0) failures.push("the install offer never appeared after beforeinstallprompt");

  /* ── The offline page ── */
  await page.goto(`${BASE}/offline`, { waitUntil: "domcontentloaded" });
  const offline = await page.locator("body").innerText();
  console.log(`  offline page: ${/internet|offline|офлайн/i.test(offline) ? "✓" : "✗"}`);
  if (!/internet|offline|офлайн/i.test(offline)) failures.push("the offline page says nothing useful");

  /* ── The prose pages ── */
  console.log("");
  for (const path of ["/about", "/privacy", "/terms"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });

    const rail = await page.locator("nav ol li a[href^='#']").count();
    const anchored = await page.locator("section[id] h2 a[href^='#']").count();
    console.log(`  ${path.padEnd(9)} rail ${rail} links, ${anchored} linkable headings`);

    if (rail === 0) failures.push(`${path} has no contents rail`);
    if (anchored === 0) failures.push(`${path} has no linkable headings`);
    if (rail !== anchored) {
      failures.push(`${path}: the rail lists ${rail} but the page has ${anchored}`);
    }

    /* And the anchors must actually reach something. */
    const broken = await page.evaluate(() =>
      [...document.querySelectorAll("nav ol li a[href^='#']")]
        .map((a) => (a as HTMLAnchorElement).getAttribute("href")!.slice(1))
        .filter((id) => !document.getElementById(id)),
    );
    if (broken.length > 0) failures.push(`${path}: rail links to nothing — ${broken.join(", ")}`);
  }

  /* The FAQ has one thread, so it should not have grown a rail. */
  await page.goto(`${BASE}/faq`, { waitUntil: "domcontentloaded" });
  const faqRail = await page.locator("nav ol li a[href^='#']").count();
  console.log(`  /faq      rail ${faqRail} links (expected 0)`);
  if (faqRail !== 0) failures.push("the FAQ grew a contents rail it does not need");

  await browser.close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} problems:`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
  }
  console.log("\n✓ installable, cached, and the long pages have their contents");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
