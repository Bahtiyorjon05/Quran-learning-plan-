import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Default study timezone. Overridden per user from their profile once they
    // have an account — every plan day boundary depends on it.
    timeZone: "Asia/Tashkent",
    formats: {
      dateTime: {
        short: { day: "numeric", month: "short", year: "numeric" },
        long: { day: "numeric", month: "long", year: "numeric" },
      },
    },
    getMessageFallback({ key }) {
      return process.env.NODE_ENV === "development" ? `⟦${key}⟧` : "";
    },
  };
});
