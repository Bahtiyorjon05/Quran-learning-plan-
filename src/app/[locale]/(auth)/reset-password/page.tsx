import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { getPendingResetEmail } from "@/auth/session";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetForm } from "@/components/auth/reset-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  const tf = await getTranslations("auth.forgot");
  const email = await getPendingResetEmail();

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link
          href="/login"
          className="font-medium text-[var(--accent-strong)] transition-colors hover:underline"
        >
          {tf("backToLogin")}
        </Link>
      }
    >
      {email && (
        <p className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-[0.875rem] leading-relaxed text-emerald-200">
          {tf("sent")}
        </p>
      )}
      <ResetForm email={email} />
    </AuthShell>
  );
}
