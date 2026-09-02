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

/**
 * How long a session survives *without use*.
 *
 * Sliding, not absolute. Someone who opens Ahd every morning — which is the
 * whole premise of the product — is never signed out; someone who has not
 * opened it in three days has to prove who they are again. An absolute three
 * days would log out the most devoted user every third morning, which is the
 * opposite of what a daily habit needs.
 *
 * The window is kept by two things that must agree: the row in `sessions`,
 * refreshed on read, and the cookie's own lifetime, refreshed by the proxy on
 * every request. A long database expiry behind a cookie that has already
 * expired signs people out regardless.
 */
export const SESSION_TTL_DAYS = 3;
/** How stale a session's last_seen may get before we refresh it. Well inside
 *  SESSION_TTL_DAYS, so an active session is always extended long before it
 *  can lapse. */
export const SESSION_REFRESH_HOURS = 6;

/** "123456" → "123 456", so a code is readable when it is read aloud. */
export function formatOtp(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}
