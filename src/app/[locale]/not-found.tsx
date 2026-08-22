import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { AhdMark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";

export default async function LocaleNotFound() {
  const t = await getTranslations("notFound");

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="animate-rise w-full max-w-md text-center">
        <div className="mx-auto w-fit">
          <AhdMark size={64} />
        </div>

        <p className="mt-8 font-[family-name:var(--font-display)] text-6xl font-light text-[var(--text-faint)] tabular-nums">
          404
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)]">
          {t("title")}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {t("body")}
        </p>

        <Link href="/" className={buttonStyles({ size: "lg", className: "mt-8" })}>
          {t("home")}
        </Link>
      </div>
    </main>
  );
}
