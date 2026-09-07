/**
 * "Mashaallah" — a page, drawn straight onto the document.
 *
 * This one deliberately sits outside React. A server action re-renders the
 * screen it was called from, and every React-shaped way of holding this moment
 * — state on the button, a store read through `useSyncExternalStore`, a
 * watcher mounted in the layout — was torn down by that re-render before the
 * congratulation had been on screen for more than a frame. The JavaScript
 * context survives; React's tree does not.
 *
 * So the card is created, appended to the body, and removed on a timer.
 * Nothing can reconcile it away because nothing owns it. The words are handed
 * in by the caller, which has the translator.
 *
 * The gold that falls around it comes from `celebrate`, shared with the juz
 * moments, which are the same thing several sizes larger.
 */

import { chime, paint } from "@/lib/celebrate";

const HOLDS_FOR = 3000;
const FADES_FOR = 450;

let current: HTMLElement | null = null;
let fade: ReturnType<typeof setTimeout> | null = null;
let gone: ReturnType<typeof setTimeout> | null = null;
let rain: ReturnType<typeof setTimeout> | null = null;
let sky: HTMLElement[] = [];

function dismiss() {
  if (!current) return;
  const node = current;
  current = null;
  node.classList.remove("ahd-page-cheer");
  node.classList.add("ahd-page-cheer-out");
  gone = setTimeout(() => node.remove(), FADES_FOR);
}

/** A page has been committed to memory. Say so, and open the sky. */
export function pageLearnt(words: { mashaallah: string; line: string }) {
  if (typeof document === "undefined") return;

  if (fade) clearTimeout(fade);
  if (gone) clearTimeout(gone);
  current?.remove();

  const host = document.createElement("div");
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  host.className =
    "ahd-page-cheer pointer-events-none fixed inset-x-0 bottom-24 z-[96] flex justify-center px-4 lg:bottom-10";

  /* Built with the DOM rather than innerHTML: the line carries a page number
     and, one day, a name, and neither should ever be parsed as markup. */
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
  line.dataset.cheerLine = "";
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
 * Say it more precisely, without interrupting.
 *
 * The gold has to fall the instant somebody taps — waiting for the server
 * means waiting about three seconds, by which time they have looked away and
 * the celebration has missed its own moment. So the card goes up immediately
 * saying what the browser already knows, and this replaces the second line
 * with the exact pages once the server has said which they were. If the card
 * has already gone, nothing happens: a correction nobody is reading is noise.
 */
export function refineLine(line: string) {
  if (!current) return;
  const el = current.querySelector<HTMLElement>("[data-cheer-line]");
  if (el) el.textContent = line;
}

/**
 * The sky, for a page.
 *
 * One layer only. The near layer — big blurred blossoms passing in front —
 * belongs to the juz moments, which have a panel of their own to sit behind.
 * Over a page of Qur'an it is simply something in the way of reading.
 */
function goldFalls() {
  for (const old of sky) old.remove();
  sky = [];

  const back = document.createElement("div");
  back.setAttribute("aria-hidden", "true");
  back.className = "ahd-fall";
  document.body.append(back);
  sky = [back];

  const life = paint(back, 0);
  chime(0);

  if (rain) clearTimeout(rain);
  rain = setTimeout(() => {
    back.remove();
    sky = sky.filter((layer) => layer !== back);
  }, life);
}
