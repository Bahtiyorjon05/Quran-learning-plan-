import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProsePage } from "@/components/site/prose-page";

type Item = { q: string; a: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.faq" });
  return { title: t("title"), description: t("lead") };
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pages.faq");
  const items = t.raw("items") as Item[];

  return (
    <ProsePage title={t("title")} lead={t("lead")}>
      {/* Plain <details> rather than a scripted accordion: it opens without
          JavaScript, it is searchable by the browser's own find, and screen
          readers already know what it is. */}
      <div className="divide-y divide-[var(--line-subtle)] border-y border-[var(--line-subtle)]">
        {items.map((item, i) => (
          <details key={item.q} name="faq" open={i === 0} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[1.0625rem] font-medium text-[var(--text-strong)] [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden
                className="mt-1.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--line-strong)] text-[var(--text-muted)] transition-transform duration-300 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 pe-9 text-[1rem] leading-[1.75] text-[var(--text-muted)]">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </ProsePage>
  );
}
