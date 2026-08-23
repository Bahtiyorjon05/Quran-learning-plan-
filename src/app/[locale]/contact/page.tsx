import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail, MessageCircle, Phone } from "lucide-react";

import { ProsePage } from "@/components/site/prose-page";

type Option = { title: string; body: string; subject: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.contact" });
  return { title: t("title"), description: t("lead") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pages.contact");
  const options = t.raw("options") as Option[];
  const email = t("email");

  return (
    <ProsePage title={t("title")} lead={t("lead")}>
      {/* A mailto rather than a form. A form here would send exactly the same
          message to exactly the same inbox, while adding a database table, a
          spam problem and a way for a message to be silently lost. This way the
          sender keeps a copy in their own sent folder. */}
      <div className="space-y-3">
        {options.map((option) => (
          <a
            key={option.subject}
            href={`mailto:${email}?subject=${encodeURIComponent(`[Ahd] ${option.subject}`)}`}
            className="group flex items-start gap-4 rounded-2xl border border-[var(--line-strong)] p-5 transition-[border-color,background-color] duration-300 hover:border-[var(--accent)]/50 hover:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
              <Mail className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.6} />
            </span>
            <span className="min-w-0">
              <span className="block text-[1rem] font-medium text-[var(--text-strong)]">
                {option.title}
              </span>
              <span className="mt-1 block text-[0.9375rem] leading-relaxed text-[var(--text-muted)]">
                {option.body}
              </span>
            </span>
          </a>
        ))}
      </div>

      <p className="mt-10 text-center text-[0.9375rem] text-[var(--text-muted)]">
        {t("writeTo")}{" "}
        <a
          href={`mailto:${email}`}
          className="font-medium text-[var(--accent-strong)] underline underline-offset-4"
        >
          {email}
        </a>
      </p>

      {/* Reaching a person directly, for anyone who would rather not write an
          email — which, for most people here, is most of the time. */}
      <div className="mt-12 border-t border-[var(--line-subtle)] pt-8">
        <h2 className="text-center text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
          {t("directly")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-[0.875rem] leading-relaxed text-[var(--text-muted)]">
          {t("directlyBody")}
        </p>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <Direct
            href={`https://t.me/${t("telegram")}`}
            icon={<MessageCircle className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.6} />}
            label={t("telegramLabel")}
            value={`@${t("telegram")}`}
            external
          />
          <Direct
            href={`tel:${t("phone").replace(/[^+\d]/g, "")}`}
            icon={<Phone className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.6} />}
            label={t("phoneLabel")}
            value={t("phone")}
          />
        </div>
      </div>
    </ProsePage>
  );
}

/** One way of reaching a person, shown the same as the others. */
function Direct({
  href,
  icon,
  label,
  value,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex items-center gap-3.5 rounded-2xl border border-[var(--line-strong)] px-4 py-3.5 transition-[border-color,background-color] duration-300 hover:border-[var(--accent)]/50 hover:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-overlay)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[0.6875rem] tracking-[0.1em] text-[var(--text-faint)] uppercase">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {value}
        </span>
      </span>
    </a>
  );
}
