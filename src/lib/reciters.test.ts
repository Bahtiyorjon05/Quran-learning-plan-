import { describe, expect, it } from "vitest";

import meta from "@/data/quran/meta.json";
import {
  DEFAULT_RECITER,
  RECITERS,
  ayahAudioUrl,
  globalAyahNumber,
  isReciterId,
  reciter,
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
  it("offers only reciters that have an edition to play", () => {
    for (const r of RECITERS) {
      expect(r.edition, `${r.id} has no edition`).toMatch(/^ar\./);
    }
    expect(RECITERS.length).toBeGreaterThan(0);
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
    expect(isReciterId("badr")).toBe(false);
    expect(reciter("badr").id).toBe(RECITERS[0].id);
  });

  it("builds a url for the right ayah", () => {
    expect(ayahAudioUrl("alafasy", 2, 255)).toBe(
      "https://cdn.islamic.network/quran/audio/64/ar.alafasy/262.mp3",
    );
    expect(ayahAudioUrl("husary", 1, 1)).toBe(
      "https://cdn.islamic.network/quran/audio/64/ar.husary/1.mp3",
    );
  });
});
