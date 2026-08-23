import { getTranslations } from "next-intl/server";
import { BookOpen, LayoutDashboard, LogOut } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "@/app/[locale]/app/actions";

/** The bar every signed-in page shares. */
export async function AppHeader() {
  const tn = await getTranslations("nav");
  const tm = await getTranslations("app.mushaf");

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl">
      <Measure className="flex h-16 items-center justify-between gap-3 sm:h-18 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Link href="/app" aria-label="Ahd" className="shrink-0">
            <Wordmark priority size={32} />
          </Link>

          <nav className="flex items-center gap-1" aria-label="App">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--text-strong)_6%,transparent)] hover:text-[var(--text-strong)]"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="max-sm:sr-only">{tn("dashboard")}</span>
            </Link>
            <Link
              href="/app/quran"
              className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--text-muted)] transition-colors hover:bg-[color-mix(in_oklab,var(--text-strong)_6%,transparent)] hover:text-[var(--text-strong)]"
            >
              <BookOpen className="h-4 w-4" />
              <span className="max-sm:sr-only">{tm("title")}</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label={tn("logout")}
              className={buttonStyles({
                variant: "outline",
                size: "sm",
                className: "max-sm:h-9 max-sm:w-9 max-sm:px-0",
              })}
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="max-sm:hidden">{tn("logout")}</span>
            </button>
          </form>
        </div>
      </Measure>
    </header>
  );
}
