"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";

import { requireUser } from "@/auth/guard";
import { setPassword } from "@/auth/service";
import { requestContext } from "@/auth/session";
import { toAuthError } from "@/auth/errors";
import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { FormState } from "@/app/[locale]/(auth)/actions";

const schema = z
  .object({
    displayName: z.string().trim().min(1, "required").max(60, "required"),
    password: z.string().min(8, "passwordTooShort").max(128, "passwordTooLong"),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordMismatch",
  });

export async function setPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  /* requireUser, not requirePasswordUser: the whole point of this screen is
     that the account does not have a password yet. */
  const user = await requireUser();
  const locale = (await getLocale()) as Locale;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  try {
    await setPassword({
      userId: user.id,
      email: user.email,
      displayName: parsed.data.displayName,
      password: parsed.data.password,
      ctx: await requestContext(),
    });
  } catch (error) {
    const authError = toAuthError(error);
    return { status: "error", error: { code: authError.code, values: authError.values } };
  }

  return redirectTo("/onboarding", locale);
}
