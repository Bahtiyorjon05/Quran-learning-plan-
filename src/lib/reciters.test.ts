import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import meta from "@/data/quran/meta.json";
import { SAVED_CACHE } from "./offline-audio";
import {
  DEFAULT_RECITER,
  RECITERS,
  ayahAudioUrl,
  followsAlong,
  globalAyahNumber,
  isReciterId,
  reciter,
  surahAudioUrl,
} from "./reciters";

describe("numbering an ayah in the whole Qur'an", () => {
  /**
   * The CDN addresses audio by position in the mushaf, 1 to 6236, and the
   * shipped index stores surah and ayah. Get this wrong by one and every
   * reciter plays the wrong verse — quietly, and on the Qur'an.
   */
  it("puts the first and last ayah at the ends", () => {
    expect(globalAyahNumber(1, 1)).toBe(1);
    expect(globalAyahNumber(114, 6)).toBe(meta.totals.ayahs);
  });

  it("agrees with the shipped index for landmarks anyone can check", () => {
    expect(globalAyahNumber(2, 1)).toBe(8); // straight after Al-Fatiha's seven
    expect(globalAyahNumber(2, 255)).toBe(262); // Ayat al-Kursi
    expect(globalAyahNumber(36, 1)).toBe(3706); // Ya-Sin
    expect(globalAyahNumber(112, 1)).toBe(6222); // Al-Ikhlas
  });

  it("counts every ayah exactly once, with no gap and no overlap", () => {
    /* Walking the whole mushaf must land on 1..6236 in order. A wrong count in
       the table shows up here and nowhere else. */
    let expected = 1;
    for (const surah of meta.surahs) {
      for (let ayah = 1; ayah <= surah.ayahs; ayah++) {
        expect(globalAyahNumber(surah.number, ayah), `${surah.number}:${ayah}`).toBe(expected);
        expected++;
      }
    }
    expect(expected - 1).toBe(meta.totals.ayahs);
  });
});

describe("the reciters", () => {
  it("gives every reciter a source of the shape its kind requires", () => {
    for (const r of RECITERS) {
      if (r.kind === "ayah") {
        expect(r.source, `${r.id} is not a CDN edition`).toMatch(/^ar\./);
        /* The bitrate belongs to the reciter. Assuming one global value is what
           made Minshawi return 403 on every verse while the others played. */
        expect([64, 128], `${r.id} has no bitrate`).toContain(r.bitrate);
      } else {
        expect(r.source, `${r.id} is not a URL`).toMatch(/^https:\/\//);
      }
    }
    expect(RECITERS.length).toBeGreaterThan(0);
  });

  it("knows which reciters can follow along and which cannot", () => {
    expect(followsAlong("alafasy")).toBe(true);
    expect(followsAlong("minshawi")).toBe(true);
    /* One file per surah, no timing data — nothing can know which verse is
       sounding, so the highlight, the scroll and ayah-repeat are all off. */
    expect(followsAlong("badr")).toBe(false);
  });

  it("builds a surah url for the reciter that needs one", () => {
    expect(surahAudioUrl("badr", 2)).toBe(
      "https://server10.mp3quran.net/bader/Rewayat-Hafs-A-n-Assem/002.mp3",
    );
    expect(surahAudioUrl("badr", 114)).toMatch(/114\.mp3$/);
  });

  it("no longer offers a reciter with nothing to play", () => {
    /* Alijon Qori is on no per-verse CDN and no surah CDN reached from here.
       A name that produces silence is worse than no name. */
    expect(isReciterId("alijon")).toBe(false);
  });

  it("names every reciter in all three languages", () => {
    for (const r of RECITERS) {
      for (const locale of ["uz", "en", "ru"] as const) {
        expect(r.name[locale].trim(), `${r.id} in ${locale}`).not.toBe("");
        expect(r.note[locale].trim(), `${r.id} note in ${locale}`).not.toBe("");
      }
      expect(r.name.ru, `${r.id} Russian name is not Cyrillic`).toMatch(/[\u0400-\u04FF]/);
    }
  });

  it("has a default that actually exists", () => {
    expect(isReciterId(DEFAULT_RECITER)).toBe(true);
    expect(reciter(DEFAULT_RECITER).id).toBe(DEFAULT_RECITER);
  });

  it("falls back rather than throwing on a reciter that was removed", () => {
    /* Someone's stored preference can name a reciter that no longer ships. */
    expect(isReciterId("alijon")).toBe(false);
    expect(reciter("alijon").id).toBe(RECITERS[0].id);
  });

  it("builds a url for the right ayah", () => {
    expect(ayahAudioUrl("alafasy", 2, 255)).toBe(
      "https://cdn.islamic.network/quran/audio/64/ar.alafasy/262.mp3",
    );
    expect(ayahAudioUrl("husary", 1, 1)).toBe(
      "https://cdn.islamic.network/quran/audio/64/ar.husary/1.mp3",
    );
    /* Minshawi publishes no 64k. Asking for one returned 403 on every verse. */
    expect(ayahAudioUrl("minshawi", 2, 255)).toBe(
      "https://cdn.islamic.network/quran/audio/128/ar.minshawi/262.mp3",
    );
  });
});

describe("keeping recitation offline", () => {
  /* The service worker is plain JavaScript in public/ and cannot import from
     the app, so the name of the cache that holds downloads is written twice.
     If the two ever drift, downloads silently stop being found and everybody
     who paid for them on mobile data is quietly back online. */
  /* Read from the project root: vitest runs there, and `import.meta.url`
     trips Vite's SSR transform in this file. */
  const worker = readFileSync("public/sw.js", "utf8");

  it("names the same cache in the app and in the service worker", () => {
    expect(worker).toContain(`const SAVED = "${SAVED_CACHE}"`);
  });

  it("spares that cache when a new version activates", () => {
    /* A deploy clears the app's own caches. It must not clear this one. */
    expect(worker).toMatch(/name !== SAVED/);
  });

  it("looks in it before the rolling cache", () => {
    /* The rolling cache evicts; this one does not. Asking it second would mean
       a download quietly falling back to the network. */
    expect(worker.indexOf("caches.open(SAVED)")).toBeLessThan(
      worker.indexOf("caches.open(AUDIO)"),
    );
  });
});
