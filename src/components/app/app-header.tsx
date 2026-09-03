import { getTranslations } from "next-intl/server";
import { LogOut, Settings, ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand/logo";
import { InstallButton } from "@/components/site/install-app";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/auth/session";
import { logoutAction } from "@/app/[locale]/app/actions";

import { AppNavDesktop, AppTabBar } from "./app-nav";

/**
 * The bar every signed-in page shares.
 *
 * The destinations left this bar on phones and moved to {@link AppTabBar} at
 * the bottom. What is left up here is what a phone can spare room for: the
 * mark, the language, the theme, and the way out.
 */
export async function AppHeader() {
  const tn = await getTranslations("nav");
  /* Only an admin is shown the way in. Everyone else gets no link and, if they
     type the address anyway, a 404 — the page should not advertise itself. */
  const user = await getCurrentUser();
  const isAdmin = user?.role === "admin";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--line-subtle)] bg-[color-mix(in_oklab,var(--surface-base)_88%,transparent)] backdrop-blur-xl">
        <Measure className="flex h-16 items-center justify-between gap-3 sm:h-18 sm:gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/app" aria-label="Ahd" className="shrink-0">
              <Wordmark priority size={32} />
            </Link>
            <AppNavDesktop />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                aria-label="Admin"
                title="Admin"
                className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--status-warning)]/35 text-[var(--status-warning-ink)] transition-colors duration-300 hover:bg-[var(--status-warning)]/10"
              >
                <ShieldCheck className="h-4 w-4" />
              </Link>
            )}
            <Link
              href="/app/settings"
              aria-label={tn("settings")}
              title={tn("settings")}
              className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-muted)] transition-colors duration-300 hover:border-[var(--line-strong)] hover:text-[var(--text-strong)]"
            >
              <Settings className="h-4 w-4" strokeWidth={1.7} />
            </Link>
            <InstallButton />
            <LanguageSwitcher />
            <ThemeToggle />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label={tn("logout")}
                className={buttonStyles({
                  variant: "outline",
                  size: "sm",
                  className: "max-lg:h-9 max-lg:w-9 max-lg:px-0",
                })}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="max-lg:hidden">{tn("logout")}</span>
              </button>
            </form>
          </div>
        </Measure>
      </header>

      <AppTabBar />
    </>
  );
}
