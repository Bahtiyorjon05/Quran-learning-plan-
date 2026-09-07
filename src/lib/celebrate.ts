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
  /* A juz, and up. These are different in kind, not degree: the screen is
     given over to them, the ground behind is darkened, and there is a panel
     holding the words — so blossoms may fall as thickly as they like without
     landing on anything anybody is trying to read. Months of work each; they
     are allowed to take the room. */
  1: { rainRate: 3.4, petals: 40, rings: 3, shafts: 5, twinkles: 20, orbs: 6, near: 6, span: 4.6 },
  /* Five. */
  2: { rainRate: 3, petals: 58, rings: 3, shafts: 7, twinkles: 26, orbs: 7, near: 8, span: 5.2 },
  /* Ten. */
  3: { rainRate: 2.6, petals: 78, rings: 4, shafts: 9, twinkles: 32, orbs: 9, near: 10, span: 5.8 },
  /* Twenty. */
  4: { rainRate: 2.2, petals: 100, rings: 5, shafts: 11, twinkles: 40, orbs: 11, near: 12, span: 6.4 },
  /* Thirty: the whole Qur'an. Nothing else in the app is allowed to look like
     this, which is the only reason it means anything when it happens. */
  5: { rainRate: 1.8, petals: 130, rings: 6, shafts: 14, twinkles: 50, orbs: 13, near: 16, span: 7.2 },
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

  /* Still a rate rather than a count, so a laptop is not drizzle. The ceiling
     rises with the tier: over a page it has to stay light enough to read
     through, and over a darkened screen with a panel on it, it does not. */
  const ceiling = 130 + tier * 42;
  const rain = Math.max(46, Math.min(ceiling, Math.round(width / layers.rainRate)));
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
 * The sound of it.
 *
 * Synthesised rather than downloaded: a struck bell is a handful of sine
 * partials over an exponential decay, which costs nothing to ship, works with
 * no network, and cannot be the file that failed to load at the one moment
 * that mattered.
 *
 * A page gets a single note. A juz and above get a phrase — a low drone
 * underneath, a melody climbing a pentatonic above it, and at ten and beyond a
 * chord to land on — all of it through a reverb built from a decaying burst of
 * noise, because dry sine tones sound like a microwave finishing and a tail on
 * them sounds like a room.
 *
 * Nothing is thrown if the browser refuses. Sound is the part of this that is
 * allowed to be missing; a phone on silent is a choice, not a fault.
 */

/* D major pentatonic across two octaves. Consonant with itself in any order,
   so a phrase can be assembled from it without landing on a sour interval. */
const SCALE = [293.66, 329.63, 391.99, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];

/** A room, made from noise that decays. */
function reverb(ctx: AudioContext, seconds: number) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      /* Exponential decay, which is what a real tail does. */
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
    }
  }
  const node = ctx.createConvolver();
  node.buffer = buffer;
  return node;
}

/** One struck note: the strike, the octave hum, and a fifth above that. */
function strike(ctx: AudioContext, to: AudioNode, at: number, freq: number, level: number) {
  const partials = [
    { ratio: 1, gain: level, decay: 3 },
    { ratio: 2, gain: level * 0.42, decay: 2 },
    { ratio: 3.01, gain: level * 0.2, decay: 1.3 },
  ];
  for (const partial of partials) {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq * partial.ratio;
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(partial.gain, at + 0.014);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + partial.decay);
    osc.connect(amp).connect(to);
    osc.start(at);
    osc.stop(at + partial.decay + 0.05);
  }
}

export function chime(tier: Tier) {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    void ctx.resume?.();

    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    /* Dry and wet in parallel, so the notes keep their attack and still have a
       tail. All of it quiet: this plays without being asked for. */
    const wet = ctx.createGain();
    wet.gain.value = tier === 0 ? 0.35 : 0.55;
    wet.connect(reverb(ctx, tier === 0 ? 1.6 : 3)).connect(master);

    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(master);
    bus.connect(wet);

    const now = ctx.currentTime + 0.03;

    if (tier === 0) {
      strike(ctx, bus, now, SCALE[5], 0.16);
      window.setTimeout(() => void ctx.close?.(), 3400);
      return;
    }

    /* The phrase. Longer and slower as the tier rises — a run of eleven notes
       hurried through in a second is a ringtone; the same notes given room to
       ring are an occasion. */
    const notes = 3 + tier * 2;
    const step = 0.34 - tier * 0.015;
    for (let n = 0; n < notes; n++) {
      strike(ctx, bus, now + n * step, SCALE[n % SCALE.length], 0.13);
    }

    /* A drone underneath, swelling and falling away. It is what turns a
       sequence of notes into music. */
    const span = LAYERS[tier].span;
    for (const freq of [73.42, 110]) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(0.05, now + 0.9);
      amp.gain.setValueAtTime(0.05, now + span * 0.6);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + span);
      osc.connect(amp).connect(bus);
      osc.start(now);
      osc.stop(now + span + 0.2);
    }

    /* From ten juz, the phrase lands on a chord rather than trailing off. */
    if (tier >= 3) {
      const at = now + notes * step + 0.2;
      for (const freq of [293.66, 369.99, 440, 587.33]) {
        strike(ctx, bus, at, freq, 0.1);
      }
    }

    window.setTimeout(() => void ctx.close?.(), (span + 4) * 1000);
  } catch {
    /* No sound. The gold is the celebration; the music is a courtesy. */
  }
}
