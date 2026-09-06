import { Wordmark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Measure } from "@/components/ui/section";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/auth/session";

import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-bell";
import { AppNavDesktop, AppTabBar } from "./app-nav";

/**
 * The bar every signed-in page shares.
 *
 * The destinations left this bar on phones and moved to {@link AppTabBar} at
 * the bottom. What is left up here is split by kind, not by room: language and
 * theme change how the page in front of you reads and stay in the open, while
 * everything about the account — settings, installing, admin, logging out —
 * collects behind {@link AccountMenu}. Six separate round icons overlapped each
 * other on a phone, and none of them said whose account this was.
 */
export async function AppHeader() {
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
            {/* Reachable from the screen people open every morning, rather than
                buried at the foot of settings. */}
            <NotificationBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <AccountMenu
              name={user?.displayName ?? ""}
              email={user?.email ?? ""}
              isAdmin={isAdmin}
            />
          </div>
        </Measure>
      </header>

      <AppTabBar />
    </>
  );
}
