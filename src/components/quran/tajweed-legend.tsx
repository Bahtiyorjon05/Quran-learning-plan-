"use client";

import { useTranslations } from "next-intl";

import { useLocalValue } from "@/lib/client-store";
import type { TajweedFamily } from "@/core/quran/tajweed";

const FAMILIES: { id: TajweedFamily; arabic: string }[] = [
  { id: "madd", arabic: "مَدّ" },
  { id: "ghunnah", arabic: "غُنَّة" },
  { id: "idgham", arabic: "إدْغام" },
  { id: "ikhfa", arabic: "إخْفاء" },
  { id: "qalqalah", arabic: "قَلْقَلَة" },
  { id: "silent", arabic: "لا يُنْطَق" },
];

/**
 * What the colours mean.
 *
 * Shown only while colouring is on, because a legend for something invisible is
 * clutter. Each entry names the rule in words as well as showing its colour —
 * a page where the meaning lives only in hue is unusable for the roughly one
 * reader in twelve who cannot separate red from green.
 */
export function TajweedLegend() {
  const t = useTranslations("quran.tajweedRules");
  const on = useLocalValue("ahd-tajweed") === "true";

  if (!on) return null;

  return (
    <div className="animate-rise mt-6 rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]/60 px-4 py-4">
      <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
        {t("heading")}
      </p>

      <ul className="mt-3 grid gap-x-5 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {FAMILIES.map((family) => (
          <li key={family.id} className="flex items-start gap-2.5">
            <span
              aria-hidden
              data-tj-swatch={family.id}
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            />
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-[0.8125rem] font-medium text-[var(--text-strong)]">
                  {t(`${family.id}.name`)}
                </span>
                <span className="font-arabic text-[0.8125rem] text-gold-ink" dir="rtl" aria-hidden>
                  {family.arabic}
                </span>
              </span>
              <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-[var(--text-muted)]">
                {t(`${family.id}.what`)}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-[var(--line-subtle)] pt-3 text-[0.6875rem] leading-relaxed text-[var(--text-faint)]">
        {t("note")}
      </p>
    </div>
  );
}
