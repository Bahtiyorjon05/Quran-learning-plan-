"use server";

import { z } from "zod";

import { requirePasswordUser, requireUser } from "@/auth/guard";
import { getCurrentUser, requestContext } from "@/auth/session";
import { toAuthError } from "@/auth/errors";
import type { FormState } from "@/auth/form-state";
import {
  accountPasswordHash,
  checkTwoFactorCode,
  confirmTwoFactorSetup,
  disableTwoFactor,
  resetTwoFactor,
  startTwoFactorReset,
  startTwoFactorSetup,
  verifySecondFactor,
} from "@/auth/two-factor";
import type { Locale } from "@/i18n/routing";
import { redirectTo } from "@/i18n/navigation";

/**
 * Everything the second password can be asked to do.
 *
 * Two of these — the challenge and its reset — are reachable by a session that
 * has *not* cleared the factor, which is the whole point of them; they use
 * {@link requireUser} rather than the onboarded guard so the guard's own
 * redirect to the challenge cannot loop through them.
 */

/* Same shape the auth actions use: a stable code, never prose. */
function failure(error: unknown): FormState {
  const authError = toAuthError(error);
  return { status: "error", error: { code: authError.code, values: authError.values } };
}

const codeField = z.string().trim().length(6, "codeLength");
const passwordField = z.string().min(8, "passwordTooShort").max(200, "passwordTooLong");

/* ── Turning it on, from settings ──────────────────────────────────────── */

export async function sendTwoFactorSetupCode(): Promise<FormState> {
  const user = await requirePasswordUser();
  try {
    await startTwoFactorSetup({ userId: user.id, email: user.email, locale: user.locale });
  } catch (error) {
    return failure(error);
  }
  return { status: "success" };
}

const enableSchema = z
  .object({
    code: codeField,
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "passwordMismatch",
  });

export async function enableTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePasswordUser();
  const parsed = enableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }

  try {
    await confirmTwoFactorSetup({
      userId: user.id,
      email: user.email,
      locale: user.locale,
      code: parsed.data.code,
      password: parsed.data.password,
      accountPasswordHash: await accountPasswordHash(user.id),
      ctx: await requestContext(),
    });
  } catch (error) {
    return failure(error);
  }

  return { status: "success" };
}

/**
 * The code on its own, before any password field exists.
 *
 * Shared by both screens that take a code: switching the second password on,
 * and replacing a forgotten one.
 */
export async function checkTwoFactorCodeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ code: codeField, purpose: z.enum(["enable", "reset"]) })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) return { status: "error", fieldErrors: { code: "codeLength" } };

  try {
    await checkTwoFactorCode({
      userId: user.id,
      code: parsed.data.code,
      purpose: parsed.data.purpose,
    });
  } catch (error) {
    return failure(error);
  }

  return { status: "success" };
}

/* ── Turning it off ────────────────────────────────────────────────────── */

export async function disableTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requirePasswordUser();
  const parsed = z
    .object({ password: z.string().min(1, "required") })
    .safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", fieldErrors: { password: "required" } };
  }

  try {
    await disableTwoFactor({
      userId: user.id,
      email: user.email,
      locale: user.locale,
      accountPassword: parsed.data.password,
      accountPasswordHash: await accountPasswordHash(user.id),
      ctx: await requestContext(),
    });
  } catch (error) {
    return failure(error);
  }

  return { status: "success" };
}

/* ── The challenge, after a correct password ───────────────────────────── */

export async function verifyTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  /* Deliberately the plain user guard: this screen exists precisely for a
     session that has not cleared the factor. */
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (!password) return { status: "error", fieldErrors: { password: "required" } };

  try {
    await verifySecondFactor({
      userId: user.id,
      sessionId: user.sessionId,
      password,
      ctx: await requestContext(),
    });
  } catch (error) {
    return failure(error);
  }

  return redirectTo("/app", user.locale as Locale);
}

/* ── Forgetting it ─────────────────────────────────────────────────────── */

export async function sendTwoFactorResetCode(): Promise<FormState> {
  const user = await requireUser();
  try {
    await startTwoFactorReset({ userId: user.id, email: user.email, locale: user.locale });
  } catch (error) {
    return failure(error);
  }
  return { status: "success" };
}

export async function resetTwoFactorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = enableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
      ),
    };
  }

  try {
    await resetTwoFactor({
      userId: user.id,
      sessionId: user.sessionId,
      email: user.email,
      locale: user.locale,
      code: parsed.data.code,
      password: parsed.data.password,
      accountPasswordHash: await accountPasswordHash(user.id),
      ctx: await requestContext(),
    });
  } catch (error) {
    return failure(error);
  }

  return redirectTo("/app", user.locale as Locale);
}

/** Whether the signed-in reader already has a second password. */
export async function twoFactorState(): Promise<{ enabled: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { enabled: false };
  const { twoFactorEnabled } = await import("@/auth/two-factor");
  return { enabled: await twoFactorEnabled(user.id) };
}

