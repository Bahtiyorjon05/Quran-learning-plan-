/**
 * Password policy — pure, dependency-free, and deliberately NOT server-only.
 *
 * The strength meter in the sign-up form scores as you type, so exactly the
 * same rules have to run in the browser. Anything that touches a secret or a
 * hash lives in ./password.ts instead, which never reaches the client.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   POLICY
   NIST SP 800-63B: length and a blocklist, not composition rules. Forcing a
   symbol and a digit produces "Password1!" and nothing safer.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "qwertyuiop", "iloveyou", "sunshine", "princess", "welcome1",
  "admin123", "letmein1", "football", "baseball", "trustno1", "starwars",
  "whatever", "superman", "abc12345", "monkey123", "dragon123", "master123",
  "shadow123", "michael1", "jennifer", "computer", "internet", "samsung1",
  "asdfghjkl", "zxcvbnm1", "11111111", "00000000", "87654321", "passw0rd",
  "muhammad", "muhammad1", "islam123", "allah123", "quran123", "tashkent",
  "uzbekistan", "toshkent", "parol123", "salom123",
]);

export type PasswordCheck = {
  ok: boolean;
  /** 0 unusable … 4 strong. A guide shown to the user, never the gate. */
  score: 0 | 1 | 2 | 3 | 4;
  reason?: "tooShort" | "tooLong" | "common" | "containsEmail";
};

export function checkPassword(password: string, email?: string): PasswordCheck {
  if (password.length < PASSWORD_MIN) return { ok: false, score: 0, reason: "tooShort" };
  if (password.length > PASSWORD_MAX) return { ok: false, score: 0, reason: "tooLong" };

  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return { ok: false, score: 0, reason: "common" };

  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, score: 1, reason: "containsEmail" };
  }

  return { ok: true, score: scorePassword(password) };
}

/**
 * A deliberately small heuristic rather than a 400 KB dictionary bundle: it
 * rewards length first, because length is what actually matters, and gives a
 * little credit for variety.
 */
export function scorePassword(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;

  let points = 0;
  if (password.length >= 8) points += 1;
  if (password.length >= 12) points += 1;
  if (password.length >= 16) points += 1;
  if (password.length >= 20) points += 1;

  const classes =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/[0-9]/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (classes >= 3) points += 1;
  if (classes === 4) points += 1;

  // A single repeated character or a straight run is not length.
  if (/^(.)\1+$/.test(password)) points = 0;
  if (/^(?:0123456789|1234567890|abcdefgh|qwertyui)/i.test(password)) points = Math.min(points, 1);

  if (COMMON.has(password.toLowerCase())) return 0;

  return Math.max(0, Math.min(4, points - 1)) as 0 | 1 | 2 | 3 | 4;
}
