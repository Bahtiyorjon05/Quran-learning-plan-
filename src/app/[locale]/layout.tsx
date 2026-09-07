import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Amiri, Amiri_Quran, Cormorant_Garamond, Inter } from "next/font/google";

import { ServiceWorker } from "@/components/site/install-app";
import { ThemeGuard } from "@/components/site/theme-guard";
import { routing, localeDir, localeTag, type Locale } from "@/i18n/routing";
import "../globals.css";

/* ── Typography ─────────────────────────────────────────────────────────────
   Inter carries Latin and Cyrillic, so Uzbek, English and Russian all render
   in the same UI voice. Cormorant Garamond is the display face — elegant and
   unhurried — and also covers Cyrillic, which most serifs do not. Amiri is a
   classical naskh for Qur'anic text until the per-page QCF mushaf fonts land
   in the reader.                                                             */

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const amiri = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

/**
 * The face the mushaf itself is set in.
 *
 * Amiri Quran is Amiri redrawn for Qur'anic text: it carries the full set of
 * vocalisation and recitation marks the Uthmani script needs, positioned for
 * them, where the general-purpose Amiri collides some of them.
 *
 * It is not a page-accurate mushaf font and does not pretend to be — those
 * are per-page fonts addressed by glyph code rather than by Unicode, which is
 * a different text pipeline, not a different font. This is the fidelity that
 * can be had honestly from a licensed webfont.
 */
const amiriQuran = Amiri_Quran({
  subsets: ["arabic"],
  weight: ["400"],
  variable: "--font-amiri-quran",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: { default: t("title"), template: t("titleTemplate", { page: "%s" }) },
    description: t("description"),
    applicationName: "Ahd",
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    ),
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: Object.fromEntries(
        routing.locales.map((l) => [
          localeTag[l],
          l === routing.defaultLocale ? "/" : `/${l}`,
        ]),
      ),
    },
    openGraph: {
      type: "website",
      siteName: "Ahd",
      title: t("title"),
      description: t("description"),
      locale: localeTag[locale as Locale],
      images: [
        { url: "/brand/og.png", width: 1200, height: 630, alt: "Ahd" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/brand/og.png"],
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060908" },
    { media: "(prefers-color-scheme: light)", color: "#fdfbf5" },
  ],
  colorScheme: "dark light",
};

/* Catches the browser's one offer to install, before React exists.
 *
 * Chrome fires `beforeinstallprompt` once per page load, very early, and if
 * nobody calls preventDefault and keeps the event it is gone for good. A React
 * effect mounts long after that moment, so the button had usually missed it —
 * and fell back to explaining where the browser hides its own menu item, which
 * is not what anybody wants from a button labelled "install".
 *
 * So the event is caught here, ahead of everything, and parked on `window` for
 * the component to pick up whenever it arrives. Firing it still has to happen
 * inside a real click; that is the browser's rule, and this only preserves the
 * chance to obey it. */
const installScript = `(function(){window.__ahdInstall=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__ahdInstall=e;window.dispatchEvent(new Event("ahd-install-ready"))});window.addEventListener("appinstalled",function(){window.__ahdInstall=null;window.dispatchEvent(new Event("ahd-install-ready"))})})();`;

/* Applied before first paint so the chosen theme never flashes. Kept tiny and
   dependency-free on purpose — it runs ahead of React. */
const themeScript = `(function(){try{var t=localStorage.getItem("ahd-theme");if(!t){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","dark")}})();`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this layout and its children into static rendering.
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={localeDir[locale]}
      /* No data-theme here: it is set by the inline script below, before
         paint, from what the reader actually chose. React re-renders this
         element whenever the locale changes and drops attributes it does not
         own, so ThemeGuard puts it back — see that file for why removing it
         from the server render was not enough on its own. */
      suppressHydrationWarning
      className={`${inter.variable} ${cormorant.variable} ${amiri.variable} ${amiriQuran.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: installScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <ThemeGuard />
          <ServiceWorker />
          {children}
        </NextIntlClientProvider>

        {/* Counting how many people open which page, and nothing else.
         *
         * Loaded from the deployment's own path rather than through
         * `@vercel/analytics`: that package declares optional peers for every
         * framework it supports, and npm refused to resolve them against a
         * Svelte/vite chain that has nothing to do with this app. The script
         * is the same one the package loads.
         *
         * Production only. In development the path does not exist, and a 404
         * in the console on every page load teaches you to ignore the console.
         *
         * It sets no cookies and follows nobody between sites — but it is
         * still a third party seeing which pages are opened, so the privacy
         * page says so in as many words. */}
        {process.env.NODE_ENV === "production" && (
          <script defer src="/_vercel/insights/script.js" />
        )}
      </body>
    </html>
  );
}
