import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link, redirectTo } from "@/i18n/navigation";
import { getCurrentUser } from "@/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

export default async function SignupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (user?.emailVerifiedAt) redirectTo("/app", locale);

  const t = await getTranslations("auth.signup");

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--accent-strong)] transition-colors hover:underline"
          >
            {t("login")}
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
