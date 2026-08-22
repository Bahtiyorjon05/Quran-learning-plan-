import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { Wordmark } from "@/components/brand/logo";

const COLUMNS = [
  {
    heading: "product",
    links: [
      { href: "/#features", key: "features" },
      { href: "/#covenant", key: "howItWorks" },
      { href: "/quran", key: "quran" },
      { href: "/pricing", key: "pricing" },
    ],
  },
  {
    heading: "learn",
    links: [
      { href: "/about", key: "about" },
      { href: "/faq", key: "faq" },
      { href: "/blog", key: "blog" },
      { href: "/contact", key: "contact" },
    ],
  },
  {
    heading: "legal",
    links: [
      { href: "/privacy", key: "privacy" },
      { href: "/terms", key: "terms" },
    ],
  },
] as const;

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="relative border-t border-[var(--line-subtle)] pt-20 pb-12">
      <div
        aria-hidden
        className="girih pointer-events-none absolute inset-0 opacity-[0.025]"
      />

      <div className="measure relative">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-[var(--text-muted)]">
              {t("tagline")}
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-[0.6875rem] font-semibold tracking-[0.18em] text-[var(--text-faint)] uppercase">
                {t(col.heading)}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
                    >
                      {t(l.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rule-fade my-12" />

        <div className="flex flex-col items-center gap-6 text-center">
          <p
            lang="ar"
            dir="rtl"
            className="font-arabic text-2xl leading-relaxed text-gold-300/90"
          >
            {t("dua")}
          </p>
          <p className="text-sm text-[var(--text-muted)]">{t("duaTranslation")}</p>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[var(--line-subtle)] pt-8 text-xs leading-relaxed text-[var(--text-faint)] sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl">{t("textNotice")}</p>
          <p className="shrink-0">{t("rights")}</p>
        </div>
      </div>
    </footer>
  );
}
