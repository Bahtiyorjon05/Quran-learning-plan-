import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* ── A cookie jar and a request, so the service can run outside Next ──────────
   The auth service reads and writes real cookies. Rather than reaching into a
   running server, we give it a minimal in-memory jar with the same surface —
   which also means the tests assert on what actually got set.               */

const jar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.7" }),
}));

/* Capture outgoing mail instead of sending it. This also lets the tests assert
   that the code really reaches the recipient, not just the database. */
const outbox: { to: string; subject: string; text: string }[] = [];

vi.mock("@/email/mailer", () => ({
  sendMail: async (mail: { to: string; subject: string; text: string }) => {
    outbox.push(mail);
    return { sent: true, via: "console" as const };
  },
  activeTransport: () => "console" as const,
}));

const { db } = await import("@/db/client");
const { users, sessions, profiles, emailVerificationCodes } = await import("@/db/schema");
const {
  login,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} = await import("./service");
const { LOCKOUT_THRESHOLD } = await import("./rate-limit");
const { checkPassword, scorePassword } = await import("./password-policy");
const { hashPassword, verifyPassword, burnPasswordTime } = await import("./password");
const { generateOtp, hashOtp, safeEqualHex } = await import("./codes");

const PASSWORD = "hifz-covenant-2026";

const created: string[] = [];

function uniqueEmail(tag: string) {
  return `auth-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@ahd.test`;
}

/**
 * A fresh client identity per test.
 *
 * Sign-up is limited to five attempts per IP per hour, which is correct in
 * production and would otherwise make the eleventh test in this file fail for
 * the wrong reason. Addresses come from TEST-NET-3 (RFC 5737), which is
 * reserved for exactly this.
 */
let ipCounter = 0;
function freshCtx() {
  ipCounter += 1;
  return {
    ip: `203.0.113.${ipCounter % 250}-${Date.now()}-${ipCounter}`,
    userAgent: "vitest",
  };
}

/** Default identity for tests that do not care about rate limiting. */
let ctx = freshCtx();

/** The six digits, taken from the email we just captured. */
function lastCode() {
  const mail = outbox.at(-1);
  const match = mail?.text.match(/(\d{3})\s?(\d{3})/);
  if (!match) throw new Error(`no code in mail: ${mail?.text}`);
  return match[1] + match[2];
}

async function register(tag: string, password = PASSWORD) {
  const email = uniqueEmail(tag);
  const result = await signup({ email, password, locale: "uz", ctx });
  created.push(result.userId);
  return { ...result, email };
}

beforeEach(() => {
  jar.clear();
  outbox.length = 0;
  ctx = freshCtx();
});

afterAll(async () => {
  for (const id of created) await db.delete(users).where(eq(users.id, id));
});

/* ═══════════════════════════════════════════════════════════════════════════ */

describe("password hashing", () => {
  it("round-trips and rejects the wrong password", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, PASSWORD + "x")).toBe(false);
  });

  it("salts, so the same password never produces the same hash twice", async () => {
    expect(await hashPassword(PASSWORD)).not.toBe(await hashPassword(PASSWORD));
  });

  it("spends real time when the account does not exist", async () => {
    /* The whole point of burnPasswordTime is that it costs the same as a real
       verification. If it ever returned instantly, timing would leak which
       addresses are registered. */
    const started = Date.now();
    await burnPasswordTime();
    expect(Date.now() - started).toBeGreaterThan(10);
  });

  it("does not crash on a corrupt stored hash", async () => {
    expect(await verifyPassword("not-a-hash", PASSWORD)).toBe(false);
  });
});

describe("password policy", () => {
  it("rejects short and common passwords", () => {
    expect(checkPassword("short").ok).toBe(false);
    expect(checkPassword("password123").ok).toBe(false);
    expect(checkPassword("parol123").ok).toBe(false);
  });

  it("rejects a password containing the email name", () => {
    expect(checkPassword("bahtiyor12345", "bahtiyor@example.com").ok).toBe(false);
  });

  it("accepts a long passphrase and scores length above symbols", () => {
    expect(checkPassword("quron bilan ahdim", "a@b.com").ok).toBe(true);
    expect(scorePassword("correct horse battery staple")).toBeGreaterThan(
      scorePassword("Aa1!xyz"),
    );
  });
});

describe("one-time codes", () => {
  it("are six digits and keep leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("hash differently for different users, so one table cannot be reused", () => {
    expect(hashOtp("user-a", "123456")).not.toBe(hashOtp("user-b", "123456"));
    expect(safeEqualHex(hashOtp("u", "123456"), hashOtp("u", "123456"))).toBe(true);
    expect(safeEqualHex(hashOtp("u", "123456"), hashOtp("u", "123457"))).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════ */

describe("signing up", () => {
  it("creates an unverified user with a profile, and emails a code", async () => {
    const { userId, email } = await register("signup");

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe(email);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).not.toContain(PASSWORD);

    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
    expect(profile.locale).toBe("uz");

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe(email);
    expect(lastCode()).toMatch(/^\d{6}$/);
  });

  it("lowercases the address so one inbox cannot become two accounts", async () => {
    const email = uniqueEmail("case").toUpperCase();
    const { userId } = await signup({ email, password: PASSWORD, locale: "en", ctx });
    created.push(userId);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.email).toBe(email.toLowerCase());

    await expect(
      signup({ email: email.toLowerCase(), password: PASSWORD, locale: "en", ctx }),
    ).rejects.toMatchObject({ code: "emailTaken" });
  });

  it("refuses a weak password before touching the database", async () => {
    await expect(
      signup({ email: uniqueEmail("weak"), password: "12345678", locale: "en", ctx }),
    ).rejects.toMatchObject({ code: "weakPassword" });
  });

  it("never stores the code itself", async () => {
    const { userId } = await register("nostore");
    const code = lastCode();

    const [row] = await db
      .select()
      .from(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, userId));

    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toHaveLength(64);
  });
});

describe("rate limiting", () => {
  it("stops a burst of sign-ups from one address", async () => {
    const attacker = freshCtx();
    let refused: unknown;

    for (let i = 0; i < 8; i++) {
      try {
        const result = await signup({
          email: uniqueEmail(`burst${i}`),
          password: PASSWORD,
          locale: "uz",
          ctx: attacker,
        });
        created.push(result.userId);
      } catch (error) {
        refused = error;
        break;
      }
    }

    expect(refused).toMatchObject({ code: "rateLimited" });
  });
});

describe("verifying an email", () => {
  it("rejects a wrong code, counts the attempt, then accepts the right one", async () => {
    const { userId, email } = await register("verify");
    const code = lastCode();
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");

    await expect(verifyEmail({ code: wrong, ctx })).rejects.toMatchObject({
      code: "codeInvalid",
    });

    const [afterMiss] = await db
      .select()
      .from(emailVerificationCodes)
      .where(eq(emailVerificationCodes.userId, userId));
    expect(afterMiss.attempts).toBe(1);

    await verifyEmail({ code, ctx });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.email).toBe(email);

    // A session cookie was issued, and it is not the raw database value.
    const cookie = jar.get("ahd_session");
    expect(cookie).toBeTruthy();

    const rows = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).not.toBe(cookie);
  });

  it("locks the code out after too many wrong attempts", async () => {
    await register("attempts");
    const wrong = "000000";

    let lastError: unknown;
    for (let i = 0; i < LOCKOUT_THRESHOLD + 1; i++) {
      await verifyEmail({ code: wrong, ctx }).catch((e) => {
        lastError = e;
      });
    }
    expect(lastError).toMatchObject({ code: "codeAttemptsExceeded" });
  });

  it("refuses to resend before the cooldown has passed", async () => {
    await register("cooldown");
    await expect(resendVerification({ locale: "uz", ctx })).rejects.toMatchObject({
      code: "resendTooSoon",
    });
  });
});

describe("logging in", () => {
  it("refuses an unverified account and issues a fresh code", async () => {
    const { email } = await register("unverified");
    outbox.length = 0;

    await expect(login({ email, password: PASSWORD, locale: "uz", ctx })).rejects.toMatchObject({
      code: "emailNotVerified",
    });
    expect(outbox).toHaveLength(1);
  });

  it("works once verified, and rejects a wrong password identically to a missing account", async () => {
    const { email } = await register("login");
    await verifyEmail({ code: lastCode(), ctx });
    jar.clear();

    await expect(
      login({ email, password: "definitely-not-it", locale: "uz", ctx }),
    ).rejects.toMatchObject({ code: "invalidCredentials" });

    await expect(
      login({ email: uniqueEmail("ghost"), password: PASSWORD, locale: "uz", ctx }),
    ).rejects.toMatchObject({ code: "invalidCredentials" });

    await login({ email, password: PASSWORD, locale: "uz", ctx });
    expect(jar.get("ahd_session")).toBeTruthy();
  });

  it("locks the account after repeated failures", async () => {
    const { email, userId } = await register("lockout");
    await verifyEmail({ code: lastCode(), ctx });

    let lastError: unknown;
    for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
      await login({ email, password: "wrong-one", locale: "uz", ctx }).catch((e) => {
        lastError = e;
      });
    }
    expect(lastError).toMatchObject({ code: "accountLocked" });

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user.lockedUntil).not.toBeNull();

    // Even the correct password is refused while the lock stands.
    await expect(login({ email, password: PASSWORD, locale: "uz", ctx })).rejects.toMatchObject({
      code: "accountLocked",
    });
  });
});

describe("resetting a password", () => {
  it("says nothing about whether the address exists", async () => {
    await expect(
      requestPasswordReset({ email: uniqueEmail("nobody"), locale: "uz", ctx }),
    ).resolves.toEqual({ ok: true });
    expect(outbox).toHaveLength(0);
  });

  it("changes the password and signs every other device out", async () => {
    const { email, userId } = await register("reset");
    await verifyEmail({ code: lastCode(), ctx });

    // Two devices signed in.
    await login({ email, password: PASSWORD, locale: "uz", ctx });
    expect(await db.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(2);

    outbox.length = 0;
    await requestPasswordReset({ email, locale: "uz", ctx });
    expect(outbox).toHaveLength(1);

    const next = "a-new-and-longer-secret";
    await resetPassword({ email, code: lastCode(), password: next, ctx });

    // Old sessions are gone; exactly the new one remains.
    const remaining = await db.select().from(sessions).where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(1);

    jar.clear();
    await expect(login({ email, password: PASSWORD, locale: "uz", ctx })).rejects.toMatchObject({
      code: "invalidCredentials",
    });
    await login({ email, password: next, locale: "uz", ctx });
    expect(jar.get("ahd_session")).toBeTruthy();
  });

  it("rejects a wrong reset code", async () => {
    const { email } = await register("resetwrong");
    await verifyEmail({ code: lastCode(), ctx });

    outbox.length = 0;
    await requestPasswordReset({ email, locale: "uz", ctx });
    const wrong = String((Number(lastCode()) + 7) % 1_000_000).padStart(6, "0");

    await expect(
      resetPassword({ email, code: wrong, password: "another-long-secret", ctx }),
    ).rejects.toMatchObject({ code: "codeInvalid" });
  });
});
