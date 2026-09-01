import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WifiOff } from "lucide-react";

import { AhdMark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offline");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * What the installed app shows when there is no network.
 *
 * Cached at install time, so it is the one page guaranteed to be there. It says
 * what is true and what still works — pages already read are in the cache, and
 * so is the recitation that was played from them.
 */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("offline");

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="animate-rise w-full max-w-md text-center">
        <div className="mx-auto w-fit">
          <AhdMark size={64} />
        </div>

        <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] px-3.5 py-1.5 text-[0.75rem] text-[var(--text-muted)]">
          <WifiOff className="h-3.5 w-3.5" />
          {t("badge")}
        </p>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)]">
          {t("title")}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {t("body")}
        </p>

        <Link href="/quran" className={buttonStyles({ size: "lg", className: "mt-8" })}>
          {t("action")}
        </Link>
      </div>
    </main>
  );
}
