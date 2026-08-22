"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCw, AlertTriangle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { AhdMark } from "@/components/brand/logo";
import { buttonStyles } from "@/components/ui/button";

/**
 * What a crash looks like.
 *
 * Without this, an unhandled error rendered Next's bare fallback — on our dark
 * ground that read as a blank black page with no explanation and no way out,
 * which is exactly how the verify-email crash was first reported.
 *
 * The digest is shown deliberately: it is the only handle a person can give us
 * to find their failure in the logs, and it reveals nothing about the error.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="animate-rise w-full max-w-md text-center">
        <div className="mx-auto w-fit">
          <AhdMark size={64} />
        </div>

        <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-clay-500/30 bg-clay-500/[0.08] px-3 py-1 text-xs text-danger">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t("title")}
        </p>

        <h1 className="mt-5 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)]">
          {t("title")}
        </h1>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
          {t("body")}
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button type="button" onClick={reset} className={buttonStyles({ size: "lg" })}>
            <RotateCw className="h-4 w-4" />
            {t("retry")}
          </button>
          <Link href="/" className={buttonStyles({ variant: "outline", size: "lg" })}>
            {t("home")}
          </Link>
        </div>

        {error.digest && (
          <p className="mt-8 font-mono text-xs text-[var(--text-faint)]">
            {t("reference")}: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
