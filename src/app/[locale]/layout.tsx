import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Amiri, Cormorant_Garamond, Inter } from "next/font/google";

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
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${cormorant.variable} ${amiri.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
