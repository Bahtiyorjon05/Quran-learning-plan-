import { useTranslations } from "next-intl";
import {
  EyeOff,
  Type,
  ArrowRightLeft,
  Shuffle,
  Blend,
  Swords,
} from "lucide-react";

import { Section, Measure, Eyebrow, SectionTitle, Lead } from "@/components/ui/section";

const MODES = [
  { key: "hide", Icon: EyeOff },
  { key: "firstWord", Icon: Type },
  { key: "next", Icon: ArrowRightLeft },
  { key: "shuffle", Icon: Shuffle },
  { key: "gap", Icon: Blend },
  { key: "mutashabihat", Icon: Swords },
] as const;

export function Practice() {
  const t = useTranslations("landing.practice");

  return (
    <Section className="border-y border-[var(--line-subtle)] bg-[var(--surface-raised)]/30">
      <Measure>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle>{t("title")}</SectionTitle>
          <Lead>{t("lead")}</Lead>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map(({ key, Icon }, i) => (
            <li
              key={key}
              className="group relative overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-base)] p-6 transition-[border-color,background-color] duration-500 hover:border-[var(--line-strong)] hover:bg-[var(--surface-raised)]"
            >
              <span
                aria-hidden
                className="absolute end-5 top-5 font-[family-name:var(--font-display)] text-4xl leading-none font-light text-[var(--text-strong)] opacity-[0.07] tabular-nums transition-opacity duration-500 group-hover:opacity-[0.13]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <Icon
                className="h-5 w-5 text-[var(--accent)] transition-transform duration-500 group-hover:scale-110"
                strokeWidth={1.6}
              />
              <h3 className="mt-5 text-base font-semibold text-[var(--text-strong)]">
                {t(`modes.${key}.title`)}
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {t(`modes.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </Measure>
    </Section>
  );
}
