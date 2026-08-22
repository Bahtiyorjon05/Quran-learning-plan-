import { useTranslations } from "next-intl";
import { Sprout, RefreshCw, Layers } from "lucide-react";

import { Section, Measure, Eyebrow, SectionTitle, Lead } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const TRACKS = [
  { key: "sabaq", ar: "سبق", role: "roleNew", Icon: Sprout, accent: "emerald" },
  { key: "sabqi", ar: "سبقي", role: "roleRecent", Icon: RefreshCw, accent: "gold" },
  { key: "manzil", ar: "منزل", role: "roleOld", Icon: Layers, accent: "emerald" },
] as const;

export function Tracks() {
  const t = useTranslations("landing.tracks");

  return (
    <Section className="border-y border-[var(--line-subtle)] bg-[var(--surface-raised)]/30">
      <Measure>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle>{t("title")}</SectionTitle>
          <Lead>{t("lead")}</Lead>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {TRACKS.map(({ key, ar, role, Icon, accent }, i) => (
            <li
              key={key}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-[var(--line-subtle)]",
                "bg-[var(--surface-base)] p-7 transition-[border-color,transform] duration-500 ease-[var(--ease-calm)]",
                "hover:-translate-y-1 hover:border-[var(--line-strong)]",
              )}
            >
              {/* The Arabic name as a watermark behind the card. */}
              <span
                aria-hidden
                dir="rtl"
                className="font-arabic pointer-events-none absolute -top-2 -end-1 text-[5.5rem] leading-none text-[var(--text-strong)] opacity-[0.045] transition-opacity duration-700 group-hover:opacity-[0.09]"
              >
                {ar}
              </span>

              <div className="relative flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5",
                      accent === "gold" ? "text-gold-400" : "text-[var(--accent)]",
                    )}
                    strokeWidth={1.6}
                  />
                </span>
                <span className="text-[0.625rem] font-semibold tracking-[0.18em] text-[var(--text-faint)] uppercase">
                  {String(i + 1).padStart(2, "0")} · {t(role)}
                </span>
              </div>

              <h3 className="relative mt-6 flex items-baseline gap-3">
                <span className="font-[family-name:var(--font-display)] text-3xl font-normal text-[var(--text-strong)]">
                  {t(`${key}.name`)}
                </span>
                <span className="font-arabic text-lg text-gold-300/80" aria-hidden dir="rtl">
                  {ar}
                </span>
              </h3>

              <p className="relative mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {t(`${key}.body`)}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 flex items-center gap-3 text-sm text-[var(--text-faint)]">
          <span aria-hidden className="h-px w-8 bg-[var(--line-strong)]" />
          {t("footnote")}
        </p>
      </Measure>
    </Section>
  );
}
