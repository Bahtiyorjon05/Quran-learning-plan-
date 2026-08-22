/**
 * Auth failures carry a stable code, never a prose message.
 *
 * The code is the i18n key: the UI renders `auth.errors.<code>` in whichever of
 * Uzbek, English or Russian the visitor is using. Nothing user-facing is ever
 * written in English inside this layer.
 */
export const AUTH_ERROR_CODES = [
  "emailTaken",
  "invalidCredentials",
  "accountLocked",
  "emailNotVerified",
  "codeInvalid",
  "codeExpired",
  "codeAttemptsExceeded",
  "resendTooSoon",
  "rateLimited",
  "weakPassword",
  "passwordMismatch",
  "emailMismatch",
  "sessionRequired",
  "verificationExpired",
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  /** Values interpolated into the translated message, e.g. { minutes: 15 }. */
  readonly values?: Record<string, string | number>;

  constructor(code: AuthErrorCode, values?: Record<string, string | number>) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.values = values;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Anything unexpected becomes `unknown` before it reaches a user. Internal
 * detail — a Postgres constraint name, a stack frame — never leaves the server.
 */
export function toAuthError(error: unknown): AuthError {
  if (isAuthError(error)) return error;
  console.error("[auth] unexpected failure:", error);
  return new AuthError("unknown");
}
