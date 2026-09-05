import { chromium } from "playwright-core";
async function main() {
  const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  for (const theme of ["dark", "light"] as const) {
    const c = await b.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: theme });
    await c.addInitScript((t) => { try { localStorage.setItem("ahd-theme", t as string); } catch {} }, theme);
    const p = await c.newPage();
    for (const [n, u] of [["home", "/"], ["login", "/login"]] as const) {
      await p.goto("http://localhost:3000" + u, { waitUntil: "networkidle" });
      await p.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
      await p.waitForTimeout(900);
      await p.screenshot({ path: `screenshots/top/${n}-${theme}-1440.png` });
    }
    await c.close();
  }
  await b.close();
  console.log("shot");
}
main();
