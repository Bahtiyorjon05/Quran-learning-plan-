import "server-only";

import { getLocale } from "next-intl/server";

import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * The gate for everything under /app.
 *
 * Deliberately a server-component check rather than middleware: the session
 * lives in Postgres, and middleware runs on the edge where the database driver
 * does not. Doing it here also means the check happens once per request, in the
 * same cached call the page already makes to find out who the user is.
 */
export async function requireUser(): Promise<CurrentUser> {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();

  if (!user) redirectTo("/login", locale);
  /* Authenticated but unproven: the account exists, so send them to finish
     verifying rather than back to the start. */
  if (!user.emailVerifiedAt) redirectTo("/verify-email", locale);

  return user;
}

/**
 * Between verifying the address and choosing a password there is a real window
 * in which someone is signed in but the account is not yet protected. They may
 * only be on the set-password screen.
 */
export async function requirePasswordUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.hasPassword) redirectTo("/set-password", user.locale);
  return user;
}

/**
 * For everything inside the product proper.
 *
 * Kept separate from requireUser because the onboarding page itself has to be
 * reachable by someone who has not onboarded — guarding it with this would
 * bounce them to it forever.
 */
export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requirePasswordUser();
  if (!user.onboardedAt) redirectTo("/onboarding", user.locale);
  return user;
}

export async function requireRole(role: "teacher" | "admin"): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role && user.role !== "admin") {
    redirectTo("/app", user.locale);
  }
  return user;
}
