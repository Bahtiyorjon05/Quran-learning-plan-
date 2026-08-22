import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  emailVerificationCodes,
  passwordResetCodes,
  profiles,
  sessions,
  users,
} from "@/db/schema";
import { passwordResetEmail, verificationEmail } from "@/email/templates";
import { sendMail } from "@/email/mailer";
import type { Locale } from "@/i18n/routing";

import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES,
  generateOtp,
  hashOtp,
  minutesFromNow,
  safeEqualHex,
} from "./codes";
import { AuthError } from "./errors";
import {
  assertPasswordAcceptable,
  burnPasswordTime,
  hashPassword,
  verifyPassword,
} from "./password";
import {
  BUCKETS,
  LOCKOUT_THRESHOLD,
  enforceRateLimit,
  lockoutMinutes,
  minutesUntil,
  recordAuthEvent,
} from "./rate-limit";
import {
  clearPendingUser,
  createSession,
  destroyAllSessions,
  destroyCurrentSession,
  getPendingUserId,
  setPendingUser,
  type RequestContext,
} from "./session";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/* ═══════════════════════════════════════════════════════════════════════════
   ISSUING CODES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Previous codes are deleted rather than marked consumed: one live code per
 * user at a time is easier to reason about, keeps the table small, and removes
 * any chance of a collision on the unique code hash.
 */
async function issueVerificationCode(userId: string, email: string, locale: Locale) {
  const code = generateOtp();

  await db.delete(emailVerificationCodes).where(eq(emailVerificationCodes.userId, userId));
  await db.insert(emailVerificationCodes).values({
    userId,
    email,
    codeHash: hashOtp(userId, code),
    expiresAt: minutesFromNow(OTP_TTL_MINUTES),
  });

  await sendMail(await verificationEmail(locale, email, code));
}

async function issueResetCode(userId: string, email: string, locale: Locale) {
  const code = generateOtp();

  await db.delete(passwordResetCodes).where(eq(passwordResetCodes.userId, userId));
  await db.insert(passwordResetCodes).values({
    userId,
    codeHash: hashOtp(userId, code),
    expiresAt: minutesFromNow(OTP_TTL_MINUTES),
  });

  await sendMail(await passwordResetEmail(locale, email, code));
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIGN UP
   ═══════════════════════════════════════════════════════════════════════════ */

export async function signup(input: {
  email: string;
  password: string;
  locale: Locale;
  ctx: RequestContext;
}) {
  const email = normalizeEmail(input.email);

  await enforceRateLimit(BUCKETS.signup, input.ctx, email);
  assertPasswordAcceptable(input.password, email);

  const [existing] = await db
    .select({ id: users.id, verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    /* Sign-up deliberately reveals that an address is taken, while password
       reset deliberately does not.
       Hiding it here would send a real person who simply forgot they had an
       account to a verification screen for a code that never arrives — a large
       usability cost for a small disclosure, since anyone can learn the same
       fact by trying to register. Reset is different: there, silence costs the
       user nothing. */
    throw new AuthError("emailTaken");
  }

  const passwordHash = await hashPassword(input.password);

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash })
      .returning({ id: users.id });

    await tx.insert(profiles).values({ userId: user.id, locale: input.locale });
    return user.id;
  });

  await recordAuthEvent({ kind: "signup", userId, email, ctx: input.ctx });
  await issueVerificationCode(userId, email, input.locale);
  await setPendingUser(userId);

  return { userId, email };
}

/* ═══════════════════════════════════════════════════════════════════════════
   VERIFY EMAIL
   ═══════════════════════════════════════════════════════════════════════════ */

/** Who the verification screen is currently asking about. */
export async function pendingVerification() {
  const userId = await getPendingUserId();
  if (!userId) return null;

  const [row] = await db
    .select({ id: users.id, email: users.email, verifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.verifiedAt) return null;
  return { userId: row.id, email: row.email };
}

export async function verifyEmail(input: { code: string; ctx: RequestContext }) {
  const pending = await pendingVerification();
  if (!pending) throw new AuthError("verificationExpired");

  const [row] = await db
    .select()
    .from(emailVerificationCodes)
    .where(
      and(
        eq(emailVerificationCodes.userId, pending.userId),
        isNull(emailVerificationCodes.consumedAt),
      ),
    )
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  if (!row) throw new AuthError("verificationExpired");
  if (row.expiresAt.getTime() < Date.now()) throw new AuthError("codeExpired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");

  const supplied = hashOtp(pending.userId, input.code.trim());

  if (!safeEqualHex(supplied, row.codeHash)) {
    await db
      .update(emailVerificationCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerificationCodes.id, row.id));

    if (row.attempts + 1 >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");
    throw new AuthError("codeInvalid", {
      remaining: OTP_MAX_ATTEMPTS - (row.attempts + 1),
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationCodes)
      .set({ consumedAt: sql`now()` })
      .where(eq(emailVerificationCodes.id, row.id));

    await tx
      .update(users)
      .set({ emailVerifiedAt: sql`now()`, email: row.email })
      .where(eq(users.id, pending.userId));
  });

  await recordAuthEvent({
    kind: "email_verified",
    userId: pending.userId,
    email: row.email,
    ctx: input.ctx,
  });

  await clearPendingUser();
  await createSession(pending.userId, input.ctx);

  return { userId: pending.userId };
}

export async function resendVerification(input: { locale: Locale; ctx: RequestContext }) {
  const pending = await pendingVerification();
  if (!pending) throw new AuthError("verificationExpired");

  await enforceRateLimit(BUCKETS.resend, input.ctx, pending.email);

  const [last] = await db
    .select({ lastSentAt: emailVerificationCodes.lastSentAt })
    .from(emailVerificationCodes)
    .where(eq(emailVerificationCodes.userId, pending.userId))
    .orderBy(desc(emailVerificationCodes.createdAt))
    .limit(1);

  if (last) {
    const elapsed = (Date.now() - last.lastSentAt.getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new AuthError("resendTooSoon", {
        seconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed),
      });
    }
  }

  await issueVerificationCode(pending.userId, pending.email, input.locale);
  await recordAuthEvent({
    kind: "verification_resent",
    userId: pending.userId,
    email: pending.email,
    ctx: input.ctx,
  });

  return { email: pending.email };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOG IN
   ═══════════════════════════════════════════════════════════════════════════ */

export async function login(input: {
  email: string;
  password: string;
  locale: Locale;
  ctx: RequestContext;
}) {
  const email = normalizeEmail(input.email);
  await enforceRateLimit(BUCKETS.login, input.ctx, email);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      emailVerifiedAt: users.emailVerifiedAt,
      failedLoginCount: users.failedLoginCount,
      lockedUntil: users.lockedUntil,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    /* Spend the same ~40ms a real verification costs, so "no such account" and
       "wrong password" are indistinguishable from the outside. */
    await burnPasswordTime();
    await recordAuthEvent({ kind: "login_failure", email, ctx: input.ctx });
    throw new AuthError("invalidCredentials");
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await recordAuthEvent({
      kind: "login_failure",
      userId: user.id,
      email,
      ctx: input.ctx,
      detail: "locked",
    });
    throw new AuthError("accountLocked", { minutes: minutesUntil(user.lockedUntil) });
  }

  const ok = await verifyPassword(user.passwordHash, input.password);

  if (!ok) {
    const failed = user.failedLoginCount + 1;
    const lockFor = lockoutMinutes(failed);

    await db
      .update(users)
      .set({
        failedLoginCount: failed,
        lockedUntil: lockFor > 0 ? minutesFromNow(lockFor) : null,
      })
      .where(eq(users.id, user.id));

    await recordAuthEvent({ kind: "login_failure", userId: user.id, email, ctx: input.ctx });

    if (lockFor > 0) {
      await recordAuthEvent({
        kind: "account_locked",
        userId: user.id,
        email,
        ctx: input.ctx,
        detail: `${lockFor}m after ${failed} failures`,
      });
      throw new AuthError("accountLocked", { minutes: lockFor });
    }

    throw new AuthError("invalidCredentials", {
      remaining: LOCKOUT_THRESHOLD - failed,
    });
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, user.id));

  /* An unverified account can authenticate but not enter: it is sent back to
     the code screen with a fresh code, rather than being told to start again. */
  if (!user.emailVerifiedAt) {
    await issueVerificationCode(user.id, user.email, input.locale);
    await setPendingUser(user.id);
    throw new AuthError("emailNotVerified");
  }

  await createSession(user.id, input.ctx);
  await recordAuthEvent({ kind: "login_success", userId: user.id, email, ctx: input.ctx });

  return { userId: user.id };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PASSWORD RESET
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Always reports success.
 *
 * Telling an anonymous visitor whether an address is registered is exactly the
 * disclosure an attacker wants, and here — unlike sign-up — hiding it costs the
 * real user nothing: they were going to check their inbox either way.
 */
export async function requestPasswordReset(input: {
  email: string;
  locale: Locale;
  ctx: RequestContext;
}) {
  const email = normalizeEmail(input.email);

  try {
    await enforceRateLimit(BUCKETS.reset, input.ctx, email);
  } catch {
    return { ok: true };
  }

  await recordAuthEvent({ kind: "password_reset_requested", email, ctx: input.ctx });

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user) await issueResetCode(user.id, user.email, input.locale);

  return { ok: true };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
  ctx: RequestContext;
}) {
  const email = normalizeEmail(input.email);
  assertPasswordAcceptable(input.password, email);

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    await burnPasswordTime();
    throw new AuthError("codeInvalid");
  }

  const [row] = await db
    .select()
    .from(passwordResetCodes)
    .where(
      and(eq(passwordResetCodes.userId, user.id), isNull(passwordResetCodes.consumedAt)),
    )
    .orderBy(desc(passwordResetCodes.createdAt))
    .limit(1);

  if (!row) throw new AuthError("codeInvalid");
  if (row.expiresAt.getTime() < Date.now()) throw new AuthError("codeExpired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");

  if (!safeEqualHex(hashOtp(user.id, input.code.trim()), row.codeHash)) {
    await db
      .update(passwordResetCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(passwordResetCodes.id, row.id));

    if (row.attempts + 1 >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");
    throw new AuthError("codeInvalid", {
      remaining: OTP_MAX_ATTEMPTS - (row.attempts + 1),
    });
  }

  const passwordHash = await hashPassword(input.password);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetCodes)
      .set({ consumedAt: sql`now()` })
      .where(eq(passwordResetCodes.id, row.id));

    await tx
      .update(users)
      .set({
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        /* Resetting a password proves control of the inbox, which is exactly
           what verification proves. Making them do both would be theatre. */
        emailVerifiedAt: sql`coalesce(email_verified_at, now())`,
      })
      .where(eq(users.id, user.id));

    /* Every existing session dies. If the reset happened because someone else
       had the account, they are logged out by it. */
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });

  await recordAuthEvent({
    kind: "password_reset_completed",
    userId: user.id,
    email,
    ctx: input.ctx,
  });

  await createSession(user.id, input.ctx);
  return { userId: user.id };
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOG OUT
   ═══════════════════════════════════════════════════════════════════════════ */

export async function logout(userId: string | null, ctx: RequestContext) {
  await destroyCurrentSession();
  if (userId) await recordAuthEvent({ kind: "logout", userId, ctx });
}

export async function logoutEverywhere(userId: string, ctx: RequestContext) {
  await destroyAllSessions(userId);
  await recordAuthEvent({ kind: "logout_all", userId, ctx });
}
