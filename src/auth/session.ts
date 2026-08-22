import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { profiles, sessions, users } from "@/db/schema";
import { isProd } from "@/lib/env";
import {
  SESSION_REFRESH_HOURS,
  SESSION_TTL_DAYS,
  daysFromNow,
  generateSessionToken,
  hashSessionToken,
} from "./codes";

export const SESSION_COOKIE = "ahd_session";
/** Set between sign-up and verification so the OTP page knows who is verifying
 *  without ever putting an email address in a URL. */
export const PENDING_COOKIE = "ahd_pending";

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax",
  path: "/",
} as const;

export type RequestContext = { ip: string | null; userAgent: string | null };

/** Best-effort client identity, for rate limiting and the sessions list. */
export async function requestContext(): Promise<RequestContext> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CREATE / DESTROY
   ═══════════════════════════════════════════════════════════════════════════ */

export async function createSession(userId: string, ctx: RequestContext) {
  const token = generateSessionToken();

  await db.insert(sessions).values({
    userId,
    tokenHash: hashSessionToken(token),
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    expiresAt: daysFromNow(SESSION_TTL_DAYS),
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...baseCookie,
    maxAge: SESSION_TTL_DAYS * 86_400,
  });

  return token;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

/** "Sign out everywhere". One DELETE, because sessions live in the database. */
export async function destroyAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  (await cookies()).delete(SESSION_COOKIE);
}

/** Housekeeping: expired rows serve no purpose and slow the index down. */
export async function pruneExpiredSessions() {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/* ═══════════════════════════════════════════════════════════════════════════
   READ
   ═══════════════════════════════════════════════════════════════════════════ */

export type CurrentUser = {
  id: string;
  email: string;
  role: "user" | "teacher" | "admin";
  displayName: string | null;
  emailVerifiedAt: Date | null;
  onboardedAt: Date | null;
  sessionId: string;
  locale: "uz" | "en" | "ru";
  timeZone: string;
  theme: "dark" | "light" | "sepia";
};

/**
 * Cached for the lifetime of one request, so a layout, a page and three server
 * components asking "who is this?" cost a single query rather than five.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);

  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      id: users.id,
      email: users.email,
      role: users.role,
      displayName: users.displayName,
      emailVerifiedAt: users.emailVerifiedAt,
      onboardedAt: profiles.onboardedAt,
      locale: profiles.locale,
      timeZone: profiles.timeZone,
      theme: profiles.theme,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row) return null;

  /* Sliding expiry, but only written occasionally: touching last_seen on every
     single request would turn every page view into a write to Frankfurt. */
  const staleAfter = Date.now() - SESSION_REFRESH_HOURS * 3_600_000;
  if (row.lastSeenAt.getTime() < staleAfter) {
    await db
      .update(sessions)
      .set({ lastSeenAt: sql`now()`, expiresAt: daysFromNow(SESSION_TTL_DAYS) })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    displayName: row.displayName,
    emailVerifiedAt: row.emailVerifiedAt,
    onboardedAt: row.onboardedAt,
    sessionId: row.sessionId,
    locale: row.locale ?? "uz",
    timeZone: row.timeZone ?? "Asia/Tashkent",
    theme: row.theme ?? "dark",
  };
});

/* ═══════════════════════════════════════════════════════════════════════════
   PENDING VERIFICATION
   ═══════════════════════════════════════════════════════════════════════════ */

export async function setPendingUser(userId: string) {
  (await cookies()).set(PENDING_COOKIE, userId, { ...baseCookie, maxAge: 30 * 60 });
}

export async function getPendingUserId(): Promise<string | null> {
  return (await cookies()).get(PENDING_COOKIE)?.value ?? null;
}

export async function clearPendingUser() {
  (await cookies()).delete(PENDING_COOKIE);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PENDING PASSWORD RESET
   The address carries from "forgot" to "reset" in an httpOnly cookie rather
   than a query string, so it never lands in a browser history, a server log or
   a shared link.
   ═══════════════════════════════════════════════════════════════════════════ */

export const RESET_COOKIE = "ahd_reset";

export async function setPendingReset(email: string) {
  (await cookies()).set(RESET_COOKIE, email, { ...baseCookie, maxAge: 30 * 60 });
}

export async function getPendingResetEmail(): Promise<string | null> {
  return (await cookies()).get(RESET_COOKIE)?.value ?? null;
}

export async function clearPendingReset() {
  (await cookies()).delete(RESET_COOKIE);
}
