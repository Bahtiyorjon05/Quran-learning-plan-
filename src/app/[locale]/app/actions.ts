"use server";

import { getLocale } from "next-intl/server";

import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { logout, logoutEverywhere } from "@/auth/service";
import { getCurrentUser, requestContext } from "@/auth/session";

export async function logoutAction() {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();
  await logout(user?.id ?? null, await requestContext());
  redirectTo("/", locale);
}

export async function logoutEverywhereAction() {
  const locale = (await getLocale()) as Locale;
  const user = await getCurrentUser();
  if (user) await logoutEverywhere(user.id, await requestContext());
  redirectTo("/login", locale);
}
