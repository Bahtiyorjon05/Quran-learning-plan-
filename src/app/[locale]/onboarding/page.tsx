import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requirePasswordUser } from "@/auth/guard";
import { AhdMark } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("when.title"), robots: { index: false, follow: false } };
}

/**
 * Onboarding, on its own page rather than inside the auth shell.
 *
 * The auth screens are a corridor — sign in, prove the address, get through.
 * This is the arrival, and it should not look like more paperwork. So: no side
 * panel selling the product to someone who has already joined, the seal at
 * full size, and the person's own name at the top.
 */
export default async function OnboardingPage() {
  /* requirePasswordUser, not requireOnboardedUser — guarding this page with the
     latter would bounce an un-onboarded person straight back to it, forever. */
  const user = await requirePasswordUser();
  if (user.onboardedAt) redirectTo("/app", user.locale);

  const t = await getTranslations("onboarding");
  const firstName = (user.displayName ?? "").trim().split(/\s+/)[0] || "";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* A warmer ground than the auth corridor: two soft light sources and the
          lattice, so arriving feels different from signing in. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-breathe absolute start-1/2 top-[-16rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--halo),transparent_62%)] blur-3xl" />
        <div className="absolute end-[-12rem] bottom-[-14rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold-500)_13%,transparent),transparent_66%)] blur-3xl" />
        <div className="girih absolute inset-0 opacity-[0.04]" />
      </div>

      <header className="flex items-center justify-between gap-3 p-5 sm:p-6">
        <AhdMark size={32} priority />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 justify-center px-5 pb-12 sm:px-8">
        <div className="flex w-full max-w-3xl flex-col">
          <div className="animate-rise py-8 text-center sm:py-12">
            <div className="mx-auto w-fit">
              <AhdMark size={88} />
            </div>
            <h1 className="mt-7 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light text-[var(--text-strong)] sm:text-[2.75rem]">
              {t("welcome", { name: firstName })}
            </h1>
            <p className="mt-3 text-[0.9375rem] text-[var(--text-muted)]">{t("intro")}</p>
          </div>

          <div className="flex flex-1 flex-col rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-sm sm:p-9">
            <OnboardingFlow />
          </div>
        </div>
      </main>
    </div>
  );
}
