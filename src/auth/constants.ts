/**
 * Auth constants shared by the server and the browser.
 *
 * Deliberately not `server-only`: the verification screen counts down the
 * resend cooldown and states the expiry, and those numbers must be the same
 * ones the server enforces. Anything that touches a secret lives in ./codes.ts.
 */

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const SESSION_TTL_DAYS = 30;
/** How stale a session's last_seen may get before we refresh it. */
export const SESSION_REFRESH_HOURS = 12;

/** "123456" → "123 456", so a code is readable when it is read aloud. */
export function formatOtp(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
