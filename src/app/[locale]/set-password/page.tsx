import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/guard";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.setPassword");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SetPasswordPage() {
  const user = await requireUser();
  // Already protected: nothing to do here.
  if (user.hasPassword) redirectTo("/onboarding", user.locale);

  const t = await getTranslations("auth.setPassword");

  return (
    <AuthShell title={t("title")} subtitle={t("subtitle")}>
      <SetPasswordForm email={user.email} />
    </AuthShell>
  );
}
