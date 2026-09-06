/**
 * "Mashaallah" — a page, drawn straight onto the document.
 *
 * This one deliberately sits outside React. A server action re-renders the
 * page it was called from, and every React-shaped way of holding this moment
 * — state on the button, a store read through `useSyncExternalStore`, a
 * watcher mounted in the layout — was torn down by that re-render before the
 * congratulation had been on screen for more than a frame. The JavaScript
 * context survives; React's tree does not.
 *
 * So the element is created, appended to `document.body`, and removed on a
 * timer. Nothing can reconcile it away because nothing owns it. The words are
 * handed in by the caller, which has the translator.
 *
 * The bigger moments — a juz, five, thirty — are ordinary React, because they
 * live on the dashboard where nothing is racing a form submission.
 */

const HOLDS_FOR = 4600;
const FADES_FOR = 550;
/* Enough to fill the screen. Twenty-two was dust and sixty-four was weather;
   this is the sky opening. They keep arriving for two and a half seconds, so
   the screen is full for as long as the words are on it rather than emptying
   out behind them. */
const MOTES = 150;

let current: HTMLElement | null = null;
let fade: ReturnType<typeof setTimeout> | null = null;
let gone: ReturnType<typeof setTimeout> | null = null;
let rain: ReturnType<typeof setTimeout> | null = null;

function dismiss() {
  if (!current) return;
  const node = current;
  current = null;
  node.classList.remove("ahd-page-cheer");
  node.classList.add("ahd-page-cheer-out");
  gone = setTimeout(() => node.remove(), FADES_FOR);
}

/** A page has been committed to memory. Say so. */
export function pageLearnt(words: { mashaallah: string; line: string }) {
  if (typeof document === "undefined") return;

  if (fade) clearTimeout(fade);
  if (gone) clearTimeout(gone);
  current?.remove();

  const host = document.createElement("div");
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  host.className =
    "ahd-page-cheer pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-10";

  /* Built with the DOM rather than innerHTML: the name is the reader's and the
     line carries a page number, and neither should ever be parsed as markup. */
  const card = document.createElement("div");
  card.className =
    "relative flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 " +
    "bg-[var(--surface-raised)] py-3.5 pe-6 ps-4 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur";

  /* The light arrives before the card does. */
  const bloom = document.createElement("span");
  bloom.className = "ahd-bloom absolute -inset-x-24 -inset-y-16 rounded-full";
  card.append(bloom);

  const seal = document.createElement("span");
  seal.className = "relative grid h-11 w-11 shrink-0 place-items-center";
  seal.innerHTML =
    '<span class="ahd-spark-halo absolute inset-0 rounded-full"></span>' +
    '<svg viewBox="0 0 24 24" class="ahd-spark-seal relative h-full w-full text-[var(--gold)]" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4.5" y="4.5" width="15" height="15" rx="0.75"></rect>' +
    '<rect x="4.5" y="4.5" width="15" height="15" rx="0.75" transform="rotate(45 12 12)"></rect>' +
    "</svg>" +
    [0, 1, 2, 3]
      .map(
        (i) =>
          `<span class="ahd-spark" style="--a:${i * 90 + 25}deg;animation-delay:${0.25 + i * 0.11}s"></span>`,
      )
      .join("");

  const text = document.createElement("span");
  text.className = "min-w-0";

  const shout = document.createElement("span");
  shout.className =
    "block font-[family-name:var(--font-display)] text-[1.125rem] leading-tight text-[var(--gold-ink)]";
  shout.textContent = words.mashaallah;

  const line = document.createElement("span");
  line.className = "mt-0.5 block text-[0.8125rem] text-[var(--text-muted)]";
  line.textContent = words.line;

  text.append(shout, line);
  card.append(seal, text);
  host.append(card);
  /* Straight onto the body, owned by nothing React renders. It survives the
     re-render a server action causes; only the timer below takes it away. */
  document.body.append(host);

  current = host;
  fade = setTimeout(dismiss, HOLDS_FOR);
  goldFalls();
}

/**
 * Gold, falling past the whole screen.
 *
 * The React version of this lives in `<Goldfall />` and the CSS is shared; this
 * is the same shower built with the DOM, for the same reason the card is —
 * nothing here can be owned by a tree that a server action is about to replace.
 * It clears itself up once the slowest mote has left the bottom of the screen.
 */
function goldFalls() {
  const sky = document.createElement("div");
  sky.setAttribute("aria-hidden", "true");
  sky.className = "ahd-fall";

  const wash = document.createElement("span");
  wash.className = "ahd-wash";
  sky.append(wash);

  let longest = 0;
  for (let i = 0; i < MOTES; i++) {
    /* Mixed rather than modular, and one lane each: see `<Goldfall />`, which
       lays the same sky down for the juz moments. */
    const r = (salt: number) => {
      let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    const lane = (i / MOTES) * 100;
    const d = 2.6 + r(3) * 2.8;
    const delay = r(4) * 2.4;
    longest = Math.max(longest, d + delay);

    const mote = document.createElement("i");
    const star = i % 3 === 0;
    mote.className = star ? "ahd-star" : "ahd-mote";
    mote.style.cssText =
      `--x:${(lane + r(1) * (100 / MOTES)).toFixed(2)}%;--y:${(6 + r(8) * 82).toFixed(1)}%;` +
      `--w:${(7 + r(2) * 14).toFixed(1)}px;` +
      `--d:${d.toFixed(2)}s;--delay:${delay.toFixed(2)}s;` +
      `--drift:${Math.round(r(5) * 130 - 65)}px;--spin:${Math.round(r(6) * 520 - 180)}deg;` +
      `--dim:${(0.55 + r(7) * 0.45).toFixed(2)}`;
    if (star) {
      mote.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linejoin="round" class="h-full w-full">' +
        '<rect x="4.5" y="4.5" width="15" height="15" rx="1"></rect>' +
        '<rect x="4.5" y="4.5" width="15" height="15" rx="1" transform="rotate(45 12 12)"></rect>' +
        "</svg>";
    }
    sky.append(mote);
  }

  document.body.append(sky);
  if (rain) clearTimeout(rain);
  rain = setTimeout(() => sky.remove(), (longest + 0.4) * 1000);
}
