import "server-only";

import { notFound } from "next/navigation";
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

/**
 * The gate on /admin.
 *
 * Stricter than {@link requireRole} on purpose. A signed-in stranger who pokes
 * at /admin should not learn that /admin is a thing: a redirect to /app says
 * "that page exists and is not yours", and a 404 says nothing at all.
 *
 * Someone who is not signed in still goes to /login, because they may well be
 * the admin with an expired session, and answering that with a 404 would be
 * unhelpful without being any more secret — every protected route in the
 * product behaves that way.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();

  if (!user) redirectTo("/login", locale);
  if (user.role !== "admin") notFound();

  return user;
}
