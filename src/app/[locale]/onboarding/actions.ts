"use server";

import { z } from "zod";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";

import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { requirePasswordUser } from "@/auth/guard";
import { redirectTo } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { DEFAULT_RECITER, isReciterId } from "@/lib/reciters";

export type OnboardingState = {
  status: "idle" | "error";
  fieldErrors?: Record<string, string>;
};

export const ONBOARDING_IDLE: OnboardingState = { status: "idle" };

const schema = z.object({
  studyTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "required")
    .optional()
    .or(z.literal("")),
  reciter: z.string().trim(),
  /* Sent by the browser rather than guessed from an IP. Every plan-day boundary
     is computed in this zone, so getting it wrong rolls someone's day over at
     the wrong hour and breaks their streak. */
  timeZone: z.string().trim().max(64).optional(),
});

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requirePasswordUser();
  const locale = (await getLocale()) as Locale;

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  const { studyTime, reciter, timeZone } = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        locale,
        preferredReciter: isReciterId(reciter) ? reciter : DEFAULT_RECITER,
        studyTime: studyTime ? studyTime : null,
        ...(isValidTimeZone(timeZone) ? { timeZone: timeZone! } : {}),
        onboardedAt: sql`now()`,
      })
      .where(eq(profiles.userId, user.id));
  });

  return redirectTo("/app", locale);
}

/** Trust nothing from a form: an unknown zone would break every date we render. */
function isValidTimeZone(value: string | undefined): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
