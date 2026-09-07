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
  orbs: number;
  /** Big, blurred blossoms drifting in front of everything. */
  near: number;
  /** How long the whole thing runs, in seconds. */
  span: number;
};

/*
 * Restraint, because more stopped being better.
 *
 * Three hundred motes and seventy blossoms over a page of Qur'an is not a
 * celebration, it is an obstruction: the words underneath disappear, the card
 * saying what happened competes with the noise in front of it, and the whole
 * thing reads as a screensaver rather than as a moment. The eye cannot hold
 * many moving things at once, so the counts now assume it.
 *
 * Three seconds for a page. Long enough to see, short enough that nobody waits
 * for their own screen back — and brevity is most of what makes a thing feel
 * expensive rather than indulgent.
 */
const LAYERS: Record<Tier, Layers> = {
  /* A page: a fall of light, a few blossoms, one ring. Nothing in front. */
  0: { rainRate: 6, petals: 11, rings: 1, shafts: 0, twinkles: 9, orbs: 3, near: 0, span: 3 },
  /* A juz, and up. These have a panel of their own to sit behind, so they can
     carry more — and they climb by adding layers, not by adding clutter. */
  1: { rainRate: 5, petals: 18, rings: 2, shafts: 3, twinkles: 14, orbs: 4, near: 3, span: 3.6 },
  /* Five. */
  2: { rainRate: 4.4, petals: 24, rings: 2, shafts: 5, twinkles: 18, orbs: 5, near: 4, span: 4 },
  /* Ten. */
  3: { rainRate: 3.8, petals: 30, rings: 3, shafts: 6, twinkles: 22, orbs: 6, near: 5, span: 4.4 },
  /* Twenty. */
  4: { rainRate: 3.2, petals: 38, rings: 3, shafts: 8, twinkles: 26, orbs: 7, near: 6, span: 4.8 },
  /* Thirty: the whole Qur'an, and the only one that earns five seconds. */
  5: { rainRate: 2.6, petals: 48, rings: 4, shafts: 10, twinkles: 32, orbs: 8, near: 8, span: 5.2 },
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

/* A rosette rather than a garden flower: petals around a centre is the shape
   already carved into every panel of this app. Two rings of them, the inner
   set offset and paler, so it reads as a blossom with depth rather than as a
   cog — one ring of identical ellipses is a gear, and a gear is not a
   celebration. */
const PETAL = (() => {
  const outer = Array.from(
    { length: 8 },
    (_, i) =>
      `<ellipse cx="12" cy="5.9" rx="2.45" ry="5.5" transform="rotate(${i * 45} 12 12)"></ellipse>`,
  ).join("");
  const inner = Array.from(
    { length: 8 },
    (_, i) =>
      `<ellipse cx="12" cy="8.4" rx="1.7" ry="3.4" opacity="0.72" fill="#fff3cf" ` +
      `transform="rotate(${i * 45 + 22.5} 12 12)"></ellipse>`,
  ).join("");
  return (
    '<svg viewBox="0 0 24 24" fill="currentColor" style="height:100%;width:100%">' +
    outer +
    inner +
    '<circle cx="12" cy="12" r="1.9" fill="#fffaf0"></circle>' +
    "</svg>"
  );
})();

/* Blossoms are not all one gold. Three tints, so a screenful of them has the
   variation a real fall of petals has. */
const TINTS = ["#e9c96a", "#f3dfa4", "#d9ab3f"];

function fallingBit(i: number, count: number, petal: boolean, stretch: number) {
  const r = (salt: number) => noise(i, salt);
  const lane = (i / count) * 100;
  /* Petals are broader, so they fall slower — the same reason they do outside.
     Both are scaled to the tier's own span, so the last one leaves the screen
     as the card does. A particle still crossing after the words have gone is
     litter, not weather. */
  const d = (petal ? 2 + r(3) * 0.7 : 1.7 + r(3) * 0.6) * stretch;
  const delay = r(4) * 0.5 * stretch;

  const el = document.createElement("i");
  el.style.cssText =
    `--x:${(lane + r(1) * (100 / count)).toFixed(2)}%;` +
    `--y:${(6 + r(8) * 82).toFixed(1)}%;` +
    `--w:${(petal ? 12 + r(2) * 10 : 5 + r(2) * 8).toFixed(1)}px;` +
    `--d:${d.toFixed(2)}s;--delay:${delay.toFixed(2)}s;` +
    `--drift:${Math.round(r(5) * 150 - 75)}px;--spin:${Math.round(r(6) * 560 - 200)}deg;` +
    `--dim:${(0.4 + r(7) * 0.4).toFixed(2)};--sway:${(1.2 + r(9) * 1).toFixed(2)}s`;

  if (petal) {
    el.className = "ahd-petal";
    el.style.color = TINTS[i % TINTS.length];
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
      `--d:${(2.2 + noise(i, 11) * 1.2).toFixed(2)}s;` +
      `--delay:${(noise(i, 12) * 0.5).toFixed(2)}s`;
    host.append(shaft);
  }

  for (let i = 0; i < layers.rings; i++) {
    const ring = document.createElement("span");
    ring.className = "ahd-ring";
    ring.style.cssText = `--d:${(1.3 + i * 0.25).toFixed(2)}s;--delay:${(i * 0.3).toFixed(2)}s`;
    host.append(ring);
  }

  /* Still a rate rather than a count, so a laptop is not drizzle — but capped
     low enough that the page underneath is still a page. */
  const rain = Math.max(46, Math.min(130, Math.round(width / layers.rainRate)));
  /* Everything is timed against three seconds, and the bigger tiers simply
     take longer in the same proportions. */
  const stretch = layers.span / 3;
  for (let i = 0; i < rain; i++) {
    const bit = fallingBit(i, rain, false, stretch);
    host.append(bit.el);
    longest = Math.max(longest, bit.life);
  }

  for (let i = 0; i < layers.petals; i++) {
    const bit = fallingBit(i, layers.petals, true, stretch);
    host.append(bit.el);
    longest = Math.max(longest, bit.life);
  }

  for (let i = 0; i < layers.orbs; i++) {
    const orb = document.createElement("span");
    orb.className = "ahd-orb";
    orb.style.cssText =
      `--x:${(noise(i, 31) * 100).toFixed(1)}%;--y:${(noise(i, 32) * 100).toFixed(1)}%;` +
      `--w:${(120 + noise(i, 33) * 200).toFixed(0)}px;` +
      `--d:${(1.8 + noise(i, 34) * 0.9).toFixed(2)}s;--delay:${(noise(i, 35) * 0.6).toFixed(2)}s;` +
      `--dim:${(0.16 + noise(i, 36) * 0.16).toFixed(2)}`;
    host.append(orb);
  }

  for (let i = 0; i < layers.twinkles; i++) {
    const spark = document.createElement("span");
    spark.className = "ahd-twinkle";
    spark.innerHTML = STAR;
    spark.style.cssText =
      `--x:${(noise(i, 21) * 96).toFixed(1)}%;--y:${(noise(i, 22) * 92).toFixed(1)}%;` +
      `--w:${(8 + noise(i, 23) * 11).toFixed(1)}px;` +
      `--d:${(1 + noise(i, 24) * 0.7).toFixed(2)}s;--delay:${(noise(i, 25) * 1.1).toFixed(2)}s`;
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
  const count = LAYERS[tier].near;
  let longest = 0;

  for (let i = 0; i < count; i++) {
    const r = (salt: number) => noise(i + 100, salt);
    const stretch = LAYERS[tier].span / 3;
    const d = (2.2 + r(3) * 0.6) * stretch;
    const delay = r(4) * 0.5 * stretch;
    longest = Math.max(longest, d + delay);

    const el = document.createElement("i");
    el.className = "ahd-petal";
    el.style.color = TINTS[i % TINTS.length];
    el.style.cssText +=
      `--x:${(r(1) * 100).toFixed(2)}%;--y:${(10 + r(8) * 70).toFixed(1)}%;` +
      `--w:${(26 + r(2) * 24).toFixed(1)}px;` +
      `--d:${d.toFixed(2)}s;--delay:${delay.toFixed(2)}s;` +
      `--drift:${Math.round(r(5) * 220 - 110)}px;--spin:${Math.round(r(6) * 400 - 140)}deg;` +
      `--dim:${(0.2 + r(7) * 0.22).toFixed(2)};--sway:${(1.6 + r(9) * 1.2).toFixed(2)}s`;
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
