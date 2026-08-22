"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";

import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { type AuthErrorCode, toAuthError } from "@/auth/errors";
import {
  login,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} from "@/auth/service";
import {
  clearPendingReset,
  getPendingResetEmail,
  requestContext,
  setPendingReset,
} from "@/auth/session";

/**
 * Every auth form speaks this one shape.
 *
 * `error` and `fieldErrors` carry translation *keys*, never sentences: the
 * server has no business deciding which of three languages the visitor reads,
 * and a key survives a locale switch that a baked-in string would not.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  /** Key under `auth.errors`, plus any values its message interpolates. */
  error?: { code: AuthErrorCode; values?: Record<string, string | number> };
  /** Field name → key under `auth.validation`. */
  fieldErrors?: Record<string, string>;
  /** Key under `auth.<page>` for a success line, e.g. a resent code. */
  notice?: string;
};

export const IDLE: FormState = { status: "idle" };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(254, "emailInvalid")
  .regex(EMAIL_RE, "emailInvalid");

const passwordField = z
  .string()
  .min(8, "passwordTooShort")
  .max(128, "passwordTooLong");

const codeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "codeLength");

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    // Keep the first problem per field; a stack of messages helps nobody.
    out[key] ??= issue.message;
  }
  return out;
}

function failure(error: unknown): FormState {
  const authError = toAuthError(error);
  return {
    status: "error",
    error: { code: authError.code, values: authError.values },
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGN UP
   ═══════════════════════════════════════════════════════════════════════════ */

const signupSchema = z
  .object({
    email: emailField,
    emailConfirm: z.string().trim().toLowerCase(),
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.email === d.emailConfirm, {
    path: ["emailConfirm"],
    message: "emailMismatch",
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordMismatch",
  });

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = (await getLocale()) as Locale;
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  try {
    await signup({
      email: parsed.data.email,
      password: parsed.data.password,
      locale,
      ctx: await requestContext(),
    });
  } catch (error) {
    return failure(error);
  }

  // Outside the try: redirect() signals by throwing, and catching it here would
  // turn a successful sign-up into an "unknown error".
  return redirectTo("/verify-email", locale);
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERIFY EMAIL
   ═══════════════════════════════════════════════════════════════════════════ */

export async function verifyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = (await getLocale()) as Locale;
  const parsed = codeField.safeParse(formData.get("code"));

  if (!parsed.success) {
    return { status: "error", fieldErrors: { code: "codeLength" } };
  }

  try {
    await verifyEmail({ code: parsed.data, ctx: await requestContext() });
  } catch (error) {
    return failure(error);
  }

  /* Straight into onboarding. The guard on /app would bounce them here anyway;
     sending them directly avoids a visible extra redirect. */
  return redirectTo("/onboarding", locale);
}

export async function resendAction(): Promise<FormState> {
  const locale = (await getLocale()) as Locale;

  try {
    await resendVerification({ locale, ctx: await requestContext() });
  } catch (error) {
    return failure(error);
  }

  return { status: "success", notice: "resent" };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOG IN
   ═══════════════════════════════════════════════════════════════════════════ */

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "required"),
});

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = (await getLocale()) as Locale;
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  let unverified = false;

  try {
    await login({
      email: parsed.data.email,
      password: parsed.data.password,
      locale,
      ctx: await requestContext(),
    });
  } catch (error) {
    const authError = toAuthError(error);
    /* A correct password on an unverified account is not a failure — the
       service has already issued a fresh code, so send them to enter it. */
    if (authError.code === "emailNotVerified") unverified = true;
    else return failure(error);
  }

  return redirectTo(unverified ? "/verify-email" : "/app", locale);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PASSWORD RESET
   ═══════════════════════════════════════════════════════════════════════════ */

export async function forgotAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = (await getLocale()) as Locale;
  const parsed = emailField.safeParse(formData.get("email"));

  if (!parsed.success) {
    return { status: "error", fieldErrors: { email: parsed.error.issues[0].message } };
  }

  try {
    await requestPasswordReset({
      email: parsed.data,
      locale,
      ctx: await requestContext(),
    });
    await setPendingReset(parsed.data);
  } catch (error) {
    return failure(error);
  }

  return redirectTo("/reset-password", locale);
}

const resetSchema = z
  .object({
    email: emailField,
    code: codeField,
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordMismatch",
  });

export async function resetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = (await getLocale()) as Locale;

  const raw = Object.fromEntries(formData);
  // The address normally rides in an httpOnly cookie from the previous step.
  raw.email ||= (await getPendingResetEmail()) ?? "";

  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  try {
    await resetPassword({
      email: parsed.data.email,
      code: parsed.data.code,
      password: parsed.data.password,
      ctx: await requestContext(),
    });
    await clearPendingReset();
  } catch (error) {
    return failure(error);
  }

  return redirectTo("/app", locale);
}
