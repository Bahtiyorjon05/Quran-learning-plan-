import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Mail } from "lucide-react";

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
    </ProsePage>
  );
}
