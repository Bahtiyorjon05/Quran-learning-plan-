import { useTranslations } from "next-intl";
import { CalendarX, Waves, EyeOff, UserMinus } from "lucide-react";

import { Section, Measure, Eyebrow, SectionTitle } from "@/components/ui/section";

const ITEMS = [
  { key: "endless", Icon: CalendarX },
  { key: "forget", Icon: Waves },
  { key: "blind", Icon: EyeOff },
  { key: "alone", Icon: UserMinus },
] as const;

export function Problem() {
  const t = useTranslations("landing.problem");

  return (
    <Section>
      <Measure>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle>{t("title")}</SectionTitle>
        </div>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--line-subtle)] bg-[var(--line-subtle)] sm:grid-cols-2">
          {ITEMS.map(({ key, Icon }) => (
            <li
              key={key}
              className="group bg-[var(--surface-base)] p-7 transition-colors duration-500 hover:bg-[var(--surface-raised)] sm:p-9"
            >
              <Icon
                className="h-6 w-6 text-[var(--text-faint)] transition-colors duration-500 group-hover:text-danger"
                strokeWidth={1.5}
              />
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-normal">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {t(`items.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </Measure>
    </Section>
  );
}
