import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { requireUser } from "@/auth/guard";
import { twoFactorEnabled } from "@/auth/two-factor";
import { AuthShell } from "@/components/auth/auth-shell";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { LogoutLink } from "@/components/auth/logout-link";
import { redirectTo } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.twoFactor");
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * The wall between a correct password and the account.
 *
 * Guarded by {@link requireUser} rather than the onboarded guard, because the
 * onboarded guard is the thing that sends people *here* — using it would loop.
 * Anyone who has already cleared the factor, or never had one, is sent on
 * rather than made to prove something twice.
 */
export default async function TwoFactorPage() {
  const user = await requireUser();

  if (!(await twoFactorEnabled(user.id))) redirectTo("/app", user.locale);
  if (user.secondFactorAt) redirectTo("/app", user.locale);

  const t = await getTranslations("auth.twoFactor");

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle", { email: user.email })}
      footer={<LogoutLink label={t("notYou")} />}
    >
      <TwoFactorForm />
    </AuthShell>
  );
}
