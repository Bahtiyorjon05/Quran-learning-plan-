import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";

/**
 * The bar for a focused flow — the covenant wizard, and anything like it later.
 *
 * Deliberately lighter than the app header: no navigation to wander off into
 * while making a commitment. But language, theme and a way out are never
 * optional. Someone who lands here in the wrong language must be able to fix
 * that without abandoning what they were doing.
 */
export async function FocusHeader({
  backHref = "/app",
  backLabelKey = "dashboard",
}: {
  backHref?: string;
  backLabelKey?: "dashboard" | "home";
}) {
  const tn = await getTranslations("nav");

  return (
    <header className="border-b border-[var(--line-subtle)]">
      <Measure className="flex h-16 items-center justify-between gap-3 sm:h-18">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={backHref}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--line-subtle)] px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]"
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            <span className="max-sm:sr-only">{tn(backLabelKey)}</span>
          </Link>
          <Link href="/app" aria-label="Ahd" className="shrink-0 max-sm:hidden">
            <Wordmark size={32} />
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </Measure>
    </header>
  );
}
