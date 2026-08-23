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
 * This is the arrival, and it should not look like more paperwork.
 *
 * On a laptop the page splits: what is being promised on the left, the two
 * questions on the right. That column is why the page exists — a form floating
 * alone in the middle of a wide screen reads as a chore, and this is the moment
 * to say what the covenant actually is before asking anything. On a phone the
 * left column becomes a short header, because there the form is the whole
 * screen and anything above it is in the way.
 */
export default async function OnboardingPage() {
  /* requirePasswordUser, not requireOnboardedUser — guarding this page with the
     latter would bounce an un-onboarded person straight back to it, forever. */
  const user = await requirePasswordUser();
  if (user.onboardedAt) redirectTo("/app", user.locale);

  const t = await getTranslations("onboarding");
  const firstName = (user.displayName ?? "").trim().split(/\s+/)[0] || "";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* A warmer ground than the auth corridor: two soft light sources and the
          lattice, so arriving feels different from signing in. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-breathe absolute start-[-10rem] top-[-16rem] h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(circle,var(--halo),transparent_62%)] blur-3xl" />
        <div className="absolute end-[-12rem] bottom-[-16rem] h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--color-gold-500)_14%,transparent),transparent_66%)] blur-3xl" />
        <div className="girih absolute inset-0 opacity-[0.045]" />
      </div>

      <header className="flex items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <AhdMark size={32} priority />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-14 sm:px-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16 lg:pt-8">
        {/* ── What is being promised ── */}
        <aside className="animate-rise lg:sticky lg:top-10 lg:self-start">
          <div className="hidden w-fit lg:block">
            <AhdMark size={72} />
          </div>

          <h1 className="mt-0 font-[family-name:var(--font-display)] text-[1.875rem] leading-tight font-light text-[var(--text-strong)] lg:mt-8 lg:text-[2.5rem]">
            {t("welcome", { name: firstName })}
          </h1>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
            {t("intro")}
          </p>

          {/* The three tracks, named here rather than explained later. Someone
              about to promise three years deserves to know what the promise is
              made of before the first question, not after the last. */}
          <ul className="mt-9 hidden space-y-5 lg:block">
            {(["sabaq", "sabqi", "manzil"] as const).map((track, i) => (
              <li key={track} className="flex gap-4">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold-500/30 bg-gold-500/[0.08] text-[0.6875rem] font-medium text-gold-ink tabular-nums">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[0.9375rem] font-medium text-[var(--text-strong)]">
                      {t(`tracks.${track}.name`)}
                    </span>
                    <span className="font-arabic text-[0.9375rem] text-gold-ink" dir="rtl" aria-hidden>
                      {t(`tracks.${track}.arabic`)}
                    </span>
                  </span>
                  <span className="mt-1 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
                    {t(`tracks.${track}.what`)}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-9 hidden border-t border-[var(--line-subtle)] pt-6 text-[0.8125rem] leading-relaxed text-[var(--text-faint)] lg:block">
            {t("laterNote")}
          </p>
        </aside>

        {/* ── The two questions ── */}
        <div className="animate-rise flex flex-col rounded-3xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/70 p-6 shadow-[0_24px_60px_-32px_var(--halo)] backdrop-blur-sm [animation-delay:100ms] sm:p-9">
          <OnboardingFlow />
        </div>
      </main>
    </div>
  );
}
