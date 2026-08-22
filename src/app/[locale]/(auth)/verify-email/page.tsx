import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { redirectTo } from "@/i18n/navigation";
import { pendingVerification } from "@/auth/service";
import { activeTransport } from "@/email/mailer";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.verify");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // No pending sign-up means there is nothing to verify — send them to log in
  // rather than showing a code box that could never succeed.
  const pending = await pendingVerification();
  if (!pending) redirectTo("/login", locale);

  const t = await getTranslations("auth.verify");

  return (
    <AuthShell
      title={t("title")}
      subtitle={t.rich("subtitle", {
        email: () => (
          <strong className="font-medium text-[var(--text-strong)]">{pending.email}</strong>
        ),
      })}
    >
      <VerifyForm showDevHint={activeTransport() === "console"} />
    </AuthShell>
  );
}
