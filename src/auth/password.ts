import "server-only";

import { hash, verify } from "@node-rs/argon2";

import { AuthError } from "./errors";
import { checkPassword } from "./password-policy";

/**
 * Argon2id at the OWASP-recommended second configuration: 19 MiB of memory,
 * two passes, one lane. Memory-hard, so a GPU farm gains far less against it
 * than it would against bcrypt.
 */
const ARGON2 = {
  /* `algorithm` is deliberately omitted: @node-rs/argon2 defaults to Argon2id
     (verified — the digests it produces carry the $argon2id$ prefix), and its
     `Algorithm` enum is declared `const enum`, which `isolatedModules` will not
     let us import. Verification reads the algorithm out of the stored hash, so
     old digests keep working regardless. */
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string) {
  return hash(password, ARGON2);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await verify(passwordHash, password, ARGON2);
  } catch {
    // A malformed stored hash is a failed login, not a crash.
    return false;
  }
}

/**
 * Burn the same work when the address does not exist.
 *
 * Without this, "no such user" returns in a millisecond while a real user costs
 * ~50ms, and anyone can enumerate accounts with a stopwatch.
 */
/* A real Argon2id hash of a published constant, at the parameters above. It is
   deliberately not a secret — its only job is to cost the same 40ms a genuine
   verification costs. It must stay in sync with ARGON2: a hash with different
   parameters would verify in a different amount of time and leak the very
   signal this exists to hide. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$jwpbNTIRKkxTxPbstqXuAA$TcJkVgWQvkDz0VyX8MALb71FuSS7FIeqCHKfk0V4evE";

export async function burnPasswordTime() {
  await verifyPassword(DUMMY_HASH, "not-the-password");
}

export {
  PASSWORD_MIN,
  PASSWORD_MAX,
  checkPassword,
  scorePassword,
  type PasswordCheck,
} from "./password-policy";

export function assertPasswordAcceptable(password: string, email?: string) {
  const result = checkPassword(password, email);
  if (!result.ok) {
    throw new AuthError("weakPassword", { reason: result.reason ?? "tooShort" });
  }
}
