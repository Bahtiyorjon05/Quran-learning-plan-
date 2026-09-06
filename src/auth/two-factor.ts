import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions, twoFactorCodes, twoFactors, users } from "@/db/schema";
import type { Locale } from "@/i18n/routing";

import { OTP_MAX_ATTEMPTS, OTP_TTL_MINUTES } from "./constants";
import { generateOtp, hashOtp, minutesFromNow, safeEqualHex } from "./codes";
import { AuthError } from "./errors";
import {
  assertPasswordAcceptable,
  burnPasswordTime,
  hashPassword,
  verifyPassword,
} from "./password";
import { recordAuthEvent } from "./rate-limit";
import type { RequestContext } from "./session";
import { sendMail } from "@/email/mailer";
import { twoFactorCodeEmail, twoFactorChangedEmail } from "@/email/templates";

/**
 * A second password, not a phone.
 *
 * Called two-factor everywhere a reader can see, which is the phrase they know,
 * but it is worth being exact about what this is and is not. Two passwords are
 * two things you *know*: strictly this is two-step verification, not
 * multi-factor. The usual second factor — an authenticator app, or an SMS —
 * does not fit the people this is built for: most do not have the app, a
 * printed recovery sheet is a thing to lose, and SMS costs money and does not
 * reach everywhere.
 *
 * So be plain about what it buys. It defends against a stolen, guessed or
 * reused *password*, which is how these accounts are actually lost. It does not
 * defend against a compromised inbox — but nothing here does: the password
 * reset runs through email too, so the inbox was already the root of trust
 * before this existed. Adding a second knowledge factor does not weaken that;
 * it closes the far commoner door.
 *
 * The rules, and why each one is there:
 *
 *   · Turning it on needs the inbox first. Setting a second password from an
 *     already-open session would mean anybody who walked up to an unlocked
 *     laptop could lock the real owner out of their own account.
 *
 *   · Turning it off needs the *account* password, freshly typed. It is the
 *     one action that lowers the account's defences, and the person doing it
 *     should have to prove they are the account holder and not someone who
 *     found the session open.
 *
 *   · Forgetting it is not being locked out. A code to the inbox sets a new
 *     one — the same proof that turning it on required, so nothing is weaker
 *     than the day it was switched on.
 *
 *   · Wrong answers cost time, not the account. The account's own lockout is
 *     left alone; a forgotten second factor must never cascade into losing the
 *     first.
 */

/** Wrong second-password guesses before the door closes for a while. */
export const SECOND_FACTOR_MAX_FAILURES = 5;

/** How long it stays closed. Long enough to be useless to a guesser. */
export const SECOND_FACTOR_LOCKOUT_MINUTES = 15;

export async function twoFactorEnabled(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: twoFactors.userId })
    .from(twoFactors)
    .where(eq(twoFactors.userId, userId))
    .limit(1);
  return Boolean(row);
}

/* ── Codes ─────────────────────────────────────────────────────────────── */

async function issueCode(
  userId: string,
  email: string,
  purpose: "enable" | "reset",
  locale: Locale,
) {
  const code = generateOtp();

  /* One live code per purpose. Asking for a new one should retire the old,
     or a code read out of an older email would still open the door. */
  await db
    .delete(twoFactorCodes)
    .where(and(eq(twoFactorCodes.userId, userId), eq(twoFactorCodes.purpose, purpose)));

  await db.insert(twoFactorCodes).values({
    userId,
    purpose,
    codeHash: hashOtp(userId, code),
    expiresAt: minutesFromNow(OTP_TTL_MINUTES),
  });

  await sendMail(await twoFactorCodeEmail(locale, email, code, purpose));
}

/**
 * Spend a code, or explain why it cannot be spent.
 *
 * Consuming and checking are one act here — unlike the password reset, where
 * the code is checked on its own screen first — because both places that call
 * this already have the new password in hand.
 */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function consumeCode(
  userId: string,
  code: string,
  purpose: "enable" | "reset",
  tx: Tx | typeof db = db,
) {
  const [row] = await tx
    .select()
    .from(twoFactorCodes)
    .where(
      and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.purpose, purpose),
        isNull(twoFactorCodes.consumedAt),
      ),
    )
    .limit(1);

  if (!row) throw new AuthError("codeInvalid");
  if (row.expiresAt.getTime() < Date.now()) throw new AuthError("codeExpired");
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");

  if (!safeEqualHex(hashOtp(userId, code.trim()), row.codeHash)) {
    await tx
      .update(twoFactorCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(twoFactorCodes.id, row.id));

    if (row.attempts + 1 >= OTP_MAX_ATTEMPTS) throw new AuthError("codeAttemptsExceeded");
    throw new AuthError("codeInvalid", { remaining: OTP_MAX_ATTEMPTS - (row.attempts + 1) });
  }

  /* Spent in one statement, conditional on still being unspent.
     Reading the row, deciding, and then marking it leaves a window in which
     two requests carrying the same code both pass the check before either
     writes — and a one-time code gets used twice. The condition moves into the
     UPDATE, so exactly one of them comes back with a row. */
  const spent = await tx
    .update(twoFactorCodes)
    .set({ consumedAt: sql`now()` })
    .where(and(eq(twoFactorCodes.id, row.id), isNull(twoFactorCodes.consumedAt)))
    .returning({ id: twoFactorCodes.id });

  if (spent.length === 0) throw new AuthError("codeInvalid");
}

/* ── Turning it on ─────────────────────────────────────────────────────── */

/** Step one: prove the inbox. */
export async function startTwoFactorSetup(input: {
  userId: string;
  email: string;
  locale: Locale;
}) {
  if (await twoFactorEnabled(input.userId)) throw new AuthError("twoFactorAlreadyOn");
  await issueCode(input.userId, input.email, "enable", input.locale);
  return { ok: true as const };
}

/** Step two: the code, and the second password it unlocks. */
export async function confirmTwoFactorSetup(input: {
  userId: string;
  email: string;
  locale: Locale;
  code: string;
  password: string;
  /** The account's own password, so the two can be compared. */
  accountPasswordHash: string | null;
  ctx: RequestContext;
}) {
  if (await twoFactorEnabled(input.userId)) throw new AuthError("twoFactorAlreadyOn");

  assertPasswordAcceptable(input.password, input.email);

  /* Two identical passwords are one password wearing a hat. If the first is
     ever guessed the second is guessed with it, and the whole point was to
     need two separate secrets. */
  if (input.accountPasswordHash && (await verifyPassword(input.accountPasswordHash, input.password))) {
    throw new AuthError("twoFactorSameAsPassword");
  }

  /* One transaction: a crash between spending the code and storing the
     password would leave the code burnt and no second factor set, so the
     reader would be asked for a code that no longer exists. */
  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await consumeCode(input.userId, input.code, "enable", tx);
    await tx.insert(twoFactors).values({ userId: input.userId, passwordHash });
  });

  await recordAuthEvent({
    kind: "two_factor_enabled",
    userId: input.userId,
    email: input.email,
    ctx: input.ctx,
  });
  await sendMail(await twoFactorChangedEmail(input.locale, input.email, "enabled"));

  return { ok: true as const };
}

/* ── Getting past it ───────────────────────────────────────────────────── */

/**
 * The challenge after a correct account password.
 *
 * On success the *session* is stamped rather than a flag set on the user: two
 * devices are two separate proofs, and signing out everywhere should revoke
 * every half-finished login along with the finished ones.
 */
export async function verifySecondFactor(input: {
  userId: string;
  sessionId: string;
  password: string;
  ctx: RequestContext;
}) {
  const [row] = await db
    .select()
    .from(twoFactors)
    .where(eq(twoFactors.userId, input.userId))
    .limit(1);

  if (!row) throw new AuthError("twoFactorNotOn");

  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    throw new AuthError("twoFactorLocked", {
      minutes: Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000)),
    });
  }

  if (!(await verifyPassword(row.passwordHash, input.password))) {
    const failed = row.failedCount + 1;
    const locked = failed >= SECOND_FACTOR_MAX_FAILURES;

    await db
      .update(twoFactors)
      .set({
        failedCount: locked ? 0 : failed,
        lockedUntil: locked
          ? new Date(Date.now() + SECOND_FACTOR_LOCKOUT_MINUTES * 60_000)
          : row.lockedUntil,
        updatedAt: sql`now()`,
      })
      .where(eq(twoFactors.userId, input.userId));

    await recordAuthEvent({ kind: "two_factor_failed", userId: input.userId, ctx: input.ctx });

    if (locked) {
      throw new AuthError("twoFactorLocked", { minutes: SECOND_FACTOR_LOCKOUT_MINUTES });
    }
    throw new AuthError("twoFactorInvalid", {
      remaining: SECOND_FACTOR_MAX_FAILURES - failed,
    });
  }

  await db
    .update(twoFactors)
    .set({ failedCount: 0, lockedUntil: null, updatedAt: sql`now()` })
    .where(eq(twoFactors.userId, input.userId));

  await db
    .update(sessions)
    .set({ secondFactorAt: sql`now()` })
    .where(eq(sessions.id, input.sessionId));

  return { ok: true as const };
}

/* ── Forgetting it ─────────────────────────────────────────────────────── */

export async function startTwoFactorReset(input: {
  userId: string;
  email: string;
  locale: Locale;
}) {
  if (!(await twoFactorEnabled(input.userId))) throw new AuthError("twoFactorNotOn");
  await issueCode(input.userId, input.email, "reset", input.locale);
  return { ok: true as const };
}

/**
 * A new second password, and the door opens on the way through.
 *
 * The session is stamped here too. Having just proved the inbox and chosen a
 * new secret, making somebody immediately type that secret back would be
 * ceremony rather than security.
 */
export async function resetTwoFactor(input: {
  userId: string;
  sessionId: string;
  email: string;
  locale: Locale;
  code: string;
  password: string;
  accountPasswordHash: string | null;
  ctx: RequestContext;
}) {
  assertPasswordAcceptable(input.password, input.email);

  if (input.accountPasswordHash && (await verifyPassword(input.accountPasswordHash, input.password))) {
    throw new AuthError("twoFactorSameAsPassword");
  }

  const passwordHash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await consumeCode(input.userId, input.code, "reset", tx);

    await tx
      .update(twoFactors)
      .set({ passwordHash, failedCount: 0, lockedUntil: null, updatedAt: sql`now()` })
      .where(eq(twoFactors.userId, input.userId));

    await tx
      .update(sessions)
      .set({ secondFactorAt: sql`now()` })
      .where(eq(sessions.id, input.sessionId));
  });

  await recordAuthEvent({
    kind: "two_factor_reset",
    userId: input.userId,
    email: input.email,
    ctx: input.ctx,
  });
  await sendMail(await twoFactorChangedEmail(input.locale, input.email, "reset"));

  return { ok: true as const };
}

/* ── Turning it off ────────────────────────────────────────────────────── */

/**
 * Off, but only for someone who can still type the account password.
 *
 * This is the one action that lowers the account's defences, so it asks for
 * the first factor freshly rather than trusting an open session. A wrong
 * answer burns the same time a wrong login does, so the form cannot be used to
 * test passwords faster than the login page would allow.
 *
 * The account password alone would be a poor gate if it were the only one —
 * anyone holding a stolen password could simply switch the second factor off
 * and walk in. It is not the only one: every caller reaches this through
 * `requirePasswordUser`, which turns away any session that has not already
 * cleared the second factor. So the password here is re-authentication, not
 * authorisation: it proves the person at the keyboard is the account holder
 * and not somebody who found the laptop open. A test holds that guard in
 * place, because the guarantee lives there rather than in this function.
 */
export async function disableTwoFactor(input: {
  userId: string;
  email: string;
  locale: Locale;
  accountPassword: string;
  accountPasswordHash: string | null;
  ctx: RequestContext;
}) {
  if (!(await twoFactorEnabled(input.userId))) throw new AuthError("twoFactorNotOn");

  if (!input.accountPasswordHash) {
    await burnPasswordTime();
    throw new AuthError("invalidCredentials");
  }

  if (!(await verifyPassword(input.accountPasswordHash, input.accountPassword))) {
    await recordAuthEvent({ kind: "two_factor_failed", userId: input.userId, ctx: input.ctx });
    throw new AuthError("invalidCredentials");
  }

  await db.transaction(async (tx) => {
    await tx.delete(twoFactors).where(eq(twoFactors.userId, input.userId));
    await tx.delete(twoFactorCodes).where(eq(twoFactorCodes.userId, input.userId));

    /* Every session that had cleared the factor forgets that it did, so a
       stamp cannot linger and quietly re-satisfy a factor switched on later.
       In the same transaction as the delete: a crash between the two would
       leave stamps that outlive the factor they were granted for. */
    await tx
      .update(sessions)
      .set({ secondFactorAt: null })
      .where(eq(sessions.userId, input.userId));
  });

  await recordAuthEvent({
    kind: "two_factor_disabled",
    userId: input.userId,
    email: input.email,
    ctx: input.ctx,
  });
  await sendMail(await twoFactorChangedEmail(input.locale, input.email, "disabled"));

  return { ok: true as const };
}

/** The account password hash, for the two calls above that need to compare. */
export async function accountPasswordHash(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ hash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.hash ?? null;
}
