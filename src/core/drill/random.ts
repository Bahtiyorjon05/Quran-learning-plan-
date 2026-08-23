/**
 * Deterministic randomness.
 *
 * Drills are generated on the server and graded on the server, so the same seed
 * has to produce the same drill twice — otherwise an answer could not be
 * checked without storing every question. It also means a drill that behaves
 * oddly can be reproduced in a test by its seed alone.
 */

export type Rng = () => number;

/** mulberry32: small, fast, and good enough for shuffling ayahs. */
export function rngFrom(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from a string, so a drill can be keyed by user, page and date. */
export function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/** Fisher–Yates, on a copy. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** `count` distinct indices from `0..length-1`, in ascending order. */
export function sampleIndices(length: number, count: number, rng: Rng): number[] {
  const wanted = Math.min(count, length);
  const chosen = new Set<number>();
  /* Bounded so a bad seed cannot spin: after enough tries, fill in order. */
  for (let guard = 0; chosen.size < wanted && guard < length * 8; guard++) {
    chosen.add(Math.floor(rng() * length));
  }
  for (let i = 0; chosen.size < wanted; i++) chosen.add(i);
  return [...chosen].sort((a, b) => a - b);
}
