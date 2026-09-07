/**
 * The celebration: light, gold, petals, rings, shafts — and a bell.
 *
 * Built with the DOM rather than with components, for two reasons. The page
 * moment happens during a server action that replaces the tree it was fired
 * from, so anything React owns is torn down before it has been seen. And the
 * juz moment wants exactly the same layers at a larger scale, so both call
 * this and neither keeps its own copy.
 *
 * Six tiers. What escalates is how many layers are lit and how long they last,
 * never the vocabulary: it stays gold, the eight-pointed khatim and a rosette
 * of petals throughout, because a celebration that reaches for new shapes at
 * each level ends up looking like a fairground rather than like a book.
 */

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

type Layers = {
  /** Motes per this many pixels of width — smaller is denser. */
  rainRate: number;
  petals: number;
  rings: number;
  shafts: number;
  twinkles: number;
  /** How long the whole thing runs, in seconds. */
  span: number;
};

const LAYERS: Record<Tier, Layers> = {
  /* A page. Full of gold, over in four seconds. */
  0: { rainRate: 2.6, petals: 14, rings: 1, shafts: 0, twinkles: 8, span: 4.4 },
  /* A juz. The light starts wheeling. */
  1: { rainRate: 2.1, petals: 30, rings: 2, shafts: 4, twinkles: 16, span: 5.6 },
  /* Five. */
  2: { rainRate: 1.8, petals: 44, rings: 3, shafts: 6, twinkles: 24, span: 6.4 },
  /* Ten. */
  3: { rainRate: 1.6, petals: 58, rings: 4, shafts: 8, twinkles: 32, span: 7 },
  /* Twenty. */
  4: { rainRate: 1.4, petals: 74, rings: 5, shafts: 10, twinkles: 40, span: 7.6 },
  /* Thirty: the whole Qur'an. Everything, for eight seconds. */
  5: { rainRate: 1.2, petals: 96, rings: 6, shafts: 14, twinkles: 52, span: 8.4 },
};

/** A hash, not a sequence: `i * k % m` correlates every field with every other. */
function noise(i: number, salt: number) {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const STAR =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linejoin="round" style="height:100%;width:100%">' +
  '<rect x="4.5" y="4.5" width="15" height="15" rx="1"></rect>' +
  '<rect x="4.5" y="4.5" width="15" height="15" rx="1" transform="rotate(45 12 12)"></rect>' +
  "</svg>";

/* A rosette rather than a garden flower: eight petals around a centre is the
   shape already carved into every panel of this app. */
const PETAL = (() => {
  const leaves = Array.from(
    { length: 8 },
    (_, i) =>
      `<ellipse cx="12" cy="6.4" rx="2.5" ry="5.2" transform="rotate(${i * 45} 12 12)"></ellipse>`,
  ).join("");
  return (
    '<svg viewBox="0 0 24 24" fill="currentColor" style="height:100%;width:100%">' +
    leaves +
    '<circle cx="12" cy="12" r="2.1" fill="#fff8e2"></circle>' +
    "</svg>"
  );
})();

function fallingBit(i: number, count: number, petal: boolean) {
  const r = (salt: number) => noise(i, salt);
  const lane = (i / count) * 100;
  /* Petals are broader, so they fall slower — the same reason they do outside. */
  const d = petal ? 3.6 + r(3) * 3 : 2.6 + r(3) * 2.8;
  const delay = r(4) * 2.4;

  const el = document.createElement("i");
  el.style.cssText =
    `--x:${(lane + r(1) * (100 / count)).toFixed(2)}%;` +
    `--y:${(6 + r(8) * 82).toFixed(1)}%;` +
    `--w:${(petal ? 13 + r(2) * 15 : 7 + r(2) * 14).toFixed(1)}px;` +
    `--d:${d.toFixed(2)}s;--delay:${delay.toFixed(2)}s;` +
    `--drift:${Math.round(r(5) * 150 - 75)}px;--spin:${Math.round(r(6) * 560 - 200)}deg;` +
    `--dim:${(0.55 + r(7) * 0.45).toFixed(2)};--sway:${(1.8 + r(9) * 1.8).toFixed(2)}s`;

  if (petal) {
    el.className = "ahd-petal";
    /* The outer element falls, the inner one sways: one element cannot do both
       without the two sets of keyframes fighting over `transform`. */
    const inner = document.createElement("span");
    inner.innerHTML = PETAL;
    el.append(inner);
  } else if (i % 3 === 0) {
    el.className = "ahd-star";
    el.innerHTML = STAR;
  } else {
    el.className = "ahd-mote";
  }

  return { el, life: d + delay };
}

/**
 * Fill a host element with the whole celebration.
 *
 * The host is expected to carry `ahd-fall`, which pins it over the screen and
 * contains its paint. Returns how long, in milliseconds, until the last of it
 * has finished, so whoever made the host knows when to take it away.
 */
export function paint(host: HTMLElement, tier: Tier): number {
  const layers = LAYERS[tier];
  const width = typeof window === "undefined" ? 430 : window.innerWidth;
  let longest = 0;

  const wash = document.createElement("span");
  wash.className = "ahd-wash";
  wash.style.animationDuration = `${layers.span}s`;
  host.append(wash);

  /* Shafts first: they belong furthest back. */
  for (let i = 0; i < layers.shafts; i++) {
    const shaft = document.createElement("span");
    shaft.className = "ahd-shaft";
    shaft.style.cssText =
      `--a:${Math.round((i / Math.max(1, layers.shafts)) * 360 - 180)}deg;` +
      `--d:${(2.8 + noise(i, 11) * 2.6).toFixed(2)}s;` +
      `--delay:${(noise(i, 12) * 1.4).toFixed(2)}s`;
    host.append(shaft);
  }

  for (let i = 0; i < layers.rings; i++) {
    const ring = document.createElement("span");
    ring.className = "ahd-ring";
    ring.style.cssText = `--d:${(1.6 + i * 0.35).toFixed(2)}s;--delay:${(i * 0.42).toFixed(2)}s`;
    host.append(ring);
  }

  /* Density is a rate, not a count: the same number across a laptop that fills
     a phone is drizzle. */
  const rain = Math.max(140, Math.min(340, Math.round(width / layers.rainRate)));
  for (let i = 0; i < rain; i++) {
    const bit = fallingBit(i, rain, false);
    host.append(bit.el);
    longest = Math.max(longest, bit.life);
  }

  for (let i = 0; i < layers.petals; i++) {
    const bit = fallingBit(i, layers.petals, true);
    host.append(bit.el);
    longest = Math.max(longest, bit.life);
  }

  for (let i = 0; i < layers.twinkles; i++) {
    const spark = document.createElement("span");
    spark.className = "ahd-twinkle";
    spark.innerHTML = STAR;
    spark.style.cssText =
      `--x:${(noise(i, 21) * 96).toFixed(1)}%;--y:${(noise(i, 22) * 92).toFixed(1)}%;` +
      `--w:${(9 + noise(i, 23) * 16).toFixed(1)}px;` +
      `--d:${(1.2 + noise(i, 24) * 1.4).toFixed(2)}s;--delay:${(noise(i, 25) * 2.4).toFixed(2)}s`;
    host.append(spark);
  }

  return Math.max(longest, layers.span) * 1000 + 400;
}

/**
 * The near layer: a handful of large petals drifting in front of everything.
 *
 * Without it the whole celebration sits behind the panel, so the middle of the
 * screen — where the words are, and where the eye actually is — has nothing
 * happening in it. These are big, slow and out of focus, which is what depth
 * looks like: near things are blurred when the eye is on something further
 * away, and they must never be sharp enough to compete with the reading.
 */
export function paintFront(host: HTMLElement, tier: Tier): number {
  const count = 5 + tier * 3;
  let longest = 0;

  for (let i = 0; i < count; i++) {
    const r = (salt: number) => noise(i + 100, salt);
    const d = 4.4 + r(3) * 3.2;
    const delay = r(4) * 2.6;
    longest = Math.max(longest, d + delay);

    const el = document.createElement("i");
    el.className = "ahd-petal";
    el.style.cssText =
      `--x:${(r(1) * 100).toFixed(2)}%;--y:${(10 + r(8) * 70).toFixed(1)}%;` +
      `--w:${(34 + r(2) * 40).toFixed(1)}px;` +
      `--d:${d.toFixed(2)}s;--delay:${delay.toFixed(2)}s;` +
      `--drift:${Math.round(r(5) * 220 - 110)}px;--spin:${Math.round(r(6) * 400 - 140)}deg;` +
      `--dim:${(0.3 + r(7) * 0.3).toFixed(2)};--sway:${(2.4 + r(9) * 2).toFixed(2)}s`;
    const inner = document.createElement("span");
    inner.innerHTML = PETAL;
    el.append(inner);
    host.append(el);
  }

  return longest * 1000 + 400;
}

/**
 * A bell.
 *
 * Synthesised rather than downloaded: a struck bell is a handful of sine
 * partials over an exponential decay, which costs nothing to ship, works with
 * no network, and cannot be the file that failed to load at the one moment
 * that mattered. It is quiet on purpose, and climbs as the tier rises — one
 * note for a page, six for the whole Qur'an.
 *
 * Nothing is thrown if the browser refuses. Sound is the part of this that is
 * allowed to be missing; a phone on silent is a choice, not a fault.
 */
export function chime(tier: Tier) {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    void ctx.resume?.();

    /* A pentatonic run, which is consonant with itself in any order — so the
       tiers can share a scale without one of them landing on a sour interval. */
    const scale = [587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const notes = Math.min(scale.length, 1 + tier);
    const now = ctx.currentTime;

    for (let n = 0; n < notes; n++) {
      const at = now + n * 0.26;
      const base = scale[n];
      /* Three partials: the strike, the hum an octave up, and a fifth above
         that. One sine is a test tone; these three are a bell. */
      const partials = [
        { ratio: 1, gain: 0.16, decay: 2.6 },
        { ratio: 2, gain: 0.07, decay: 1.8 },
        { ratio: 3.01, gain: 0.035, decay: 1.2 },
      ];
      for (const partial of partials) {
        const osc = ctx.createOscillator();
        const amp = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = base * partial.ratio;
        amp.gain.setValueAtTime(0.0001, at);
        amp.gain.exponentialRampToValueAtTime(partial.gain, at + 0.012);
        amp.gain.exponentialRampToValueAtTime(0.0001, at + partial.decay);
        osc.connect(amp).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + partial.decay + 0.05);
      }
    }

    /* Close it once it has rung out, or a tab that celebrates often collects
       audio contexts until the browser refuses to make another. */
    window.setTimeout(() => void ctx.close?.(), (notes * 0.26 + 3) * 1000);
  } catch {
    /* No sound. The gold is the celebration; the bell is a courtesy. */
  }
}
