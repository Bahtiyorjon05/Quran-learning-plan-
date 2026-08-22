import { defineRouting } from "next-intl/routing";

/**
 * Ahd ships trilingual from day one.
 *
 * Uzbek is the default and carries no URL prefix — the project is built for
 * Uzbekistan first. English and Russian are prefixed (`/en`, `/ru`).
 * Arabic (with full RTL) lands in Phase 2; the `dir` plumbing below is already
 * in place so adding it is a data change, not a refactor.
 */
export const routing = defineRouting({
  locales: ["uz", "en", "ru"],
  defaultLocale: "uz",
  localePrefix: "as-needed",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const localeNames: Record<Locale, string> = {
  uz: "O'zbekcha",
  en: "English",
  ru: "Русский",
};

/** Short label for the compact language switcher. */
export const localeShort: Record<Locale, string> = {
  uz: "UZ",
  en: "EN",
  ru: "RU",
};

/** Text direction per locale. Arabic will be "rtl" when it arrives. */
export const localeDir: Record<Locale, "ltr" | "rtl"> = {
  uz: "ltr",
  en: "ltr",
  ru: "ltr",
};

/** BCP-47 tag used for Intl formatting and the <html lang> attribute. */
export const localeTag: Record<Locale, string> = {
  uz: "uz-UZ",
  en: "en-US",
  ru: "ru-RU",
};
