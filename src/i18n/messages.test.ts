import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import uz from "../../messages/uz.json";
import ru from "../../messages/ru.json";
import { routing } from "./routing";

/**
 * A missing translation is a blank screen in someone's language, and nobody
 * testing in English will ever see it. English is the reference: every locale
 * must carry exactly the same key set, and every ICU placeholder must survive
 * translation.
 */

type Json = { [key: string]: string | Json };

function flatten(node: Json, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

function placeholders(message: string): Set<string> {
  return new Set(
    [...message.matchAll(/\{(\w+)(?:,[^}]*)?\}/g)].map((match) => match[1]),
  );
}

const LOCALES = { en, uz, ru } as unknown as Record<string, Json>;
const flat = Object.fromEntries(
  Object.entries(LOCALES).map(([locale, messages]) => [locale, flatten(messages)]),
);

describe("translations", () => {
  it("covers every locale the router advertises", () => {
    expect(Object.keys(LOCALES).sort()).toEqual([...routing.locales].sort());
  });

  for (const locale of Object.keys(LOCALES)) {
    if (locale === "en") continue;

    it(`${locale} has no missing keys`, () => {
      const missing = [...flat.en.keys()].filter((key) => !flat[locale].has(key));
      expect(missing, `missing in ${locale}`).toEqual([]);
    });

    it(`${locale} has no stray keys`, () => {
      const extra = [...flat[locale].keys()].filter((key) => !flat.en.has(key));
      expect(extra, `not present in en`).toEqual([]);
    });

    it(`${locale} keeps every ICU placeholder`, () => {
      const broken: string[] = [];
      for (const [key, english] of flat.en) {
        const translated = flat[locale].get(key);
        if (translated === undefined) continue;

        const want = placeholders(english);
        const got = placeholders(translated);
        for (const name of want) {
          if (!got.has(name)) broken.push(`${key}: missing {${name}}`);
        }
        for (const name of got) {
          if (!want.has(name)) broken.push(`${key}: unexpected {${name}}`);
        }
      }
      expect(broken).toEqual([]);
    });

    it(`${locale} has no empty strings`, () => {
      const empty = [...flat[locale].entries()]
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty).toEqual([]);
    });

    it(`${locale} is actually translated, not copied from English`, () => {
      /* Proper nouns, brand strings and the Arabic du'a are legitimately
         identical across locales; anything else being byte-identical to the
         English almost always means a forgotten string. */
      const allowed = /(^meta\.titleTemplate|^footer\.dua$|^landing\.hadith\.arabic$|^landing\.tracks\.(sabaq|sabqi|manzil)\.name$|^auth\.signup\.emailPlaceholder$|^pages\.contact\.email$)/;
      const copied = [...flat.en.entries()]
        .filter(([key, value]) => {
          if (allowed.test(key)) return false;
          const translated = flat[locale].get(key);
          return translated === value && value.length > 12;
        })
        .map(([key]) => key);
      expect(copied).toEqual([]);
    });
  }
});
