import "server-only";

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { OTP_LENGTH } from "./constants";

export {
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  SESSION_TTL_DAYS,
  SESSION_REFRESH_HOURS,
  formatOtp,
} from "./constants";

/**
 * A six-digit code from a CSPRNG.
 *
 * `randomInt` is used rather than `randomBytes % 1_000_000`, which would be
 * very slightly biased towards low codes.
 */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

/**
 * Codes are stored as HMAC-SHA256("<userId>:<code>") under AUTH_SECRET.
 *
 * A six-digit space is only a million values, so a plain hash in a leaked table
 * would fall to a laptop in seconds. The HMAC key means an attacker also needs
 * the application secret, and folding in the user id means one precomputed
 * table cannot be reused across accounts.
 */
export function hashOtp(userId: string, code: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

/** Opaque 256-bit session token, URL-safe. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Session tokens are high-entropy already, so a plain SHA-256 is enough — there
 * is nothing to brute-force. Deliberately fast: this runs on every request.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}
