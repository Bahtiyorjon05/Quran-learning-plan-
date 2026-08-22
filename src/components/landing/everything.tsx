import { useTranslations } from "next-intl";
import {
  WifiOff,
  AudioLines,
  Mic,
  Users,
  GraduationCap,
  BellRing,
  Languages,
  Download,
  Monitor,
  Smartphone,
  Apple,
} from "lucide-react";

import { Section, Measure, Eyebrow, SectionTitle } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "offline", Icon: WifiOff, wide: false },
  { key: "audio", Icon: AudioLines, wide: true },
  { key: "record", Icon: Mic, wide: false },
  { key: "halaqah", Icon: Users, wide: false },
  { key: "teacher", Icon: GraduationCap, wide: false },
  { key: "reminders", Icon: BellRing, wide: false },
  { key: "languages", Icon: Languages, wide: false },
  { key: "yours", Icon: Download, wide: false },
] as const;

export function Everything() {
  const t = useTranslations("landing.everything");
  const tp = useTranslations("landing.platforms");

  return (
    <Section>
      <Measure>
        <div className="max-w-3xl">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <SectionTitle>{t("title")}</SectionTitle>
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ key, Icon, wide }) => (
            <li
              key={key}
              className={cn(
                "group rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/50 p-6",
                "transition-[border-color,transform] duration-500 ease-[var(--ease-calm)] hover:-translate-y-0.5 hover:border-[var(--line-strong)]",
                wide && "sm:col-span-2 lg:col-span-1",
              )}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
                <Icon className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={1.6} />
              </span>
              <h3 className="mt-5 text-base font-semibold text-[var(--text-strong)]">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
                {t(`items.${key}.body`)}
              </p>
              {key === "audio" && (
                <p className="mt-4 border-t border-[var(--line-subtle)] pt-3 text-xs leading-relaxed text-[var(--text-faint)]">
                  {t("items.audio.reciters")}
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* ── Where it runs ── */}
        <div className="mt-10 flex flex-wrap items-center gap-3">
          {[
            { Icon: Monitor, label: tp("web"), soon: false },
            { Icon: Smartphone, label: tp("android"), soon: true },
            { Icon: Apple, label: tp("ios"), soon: true },
          ].map(({ Icon, label, soon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line-subtle)] bg-[var(--surface-raised)]/60 px-4 py-2 text-xs text-[var(--text-muted)]"
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
              {label}
              {soon && (
                <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[0.625rem] font-medium tracking-wide text-gold-300">
                  {tp("soon")}
                </span>
              )}
            </span>
          ))}
        </div>
      </Measure>
    </Section>
  );
}
