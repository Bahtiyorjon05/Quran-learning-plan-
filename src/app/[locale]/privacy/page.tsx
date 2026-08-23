import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProsePage, ProseSection } from "@/components/site/prose-page";

type Section = { heading: string; body: string[] };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages.privacy" });
  return { title: t("title"), description: t("lead") };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("pages.privacy");
  const sections = t.raw("sections") as Section[];

  return (
    <ProsePage
      title={t("title")}
      lead={t("lead")}
      updated={t.has("updated") ? t("updated") : undefined}
    >
      {sections.map((section) => (
        <ProseSection key={section.heading} heading={section.heading}>
          {section.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </ProseSection>
      ))}
    </ProsePage>
  );
}
