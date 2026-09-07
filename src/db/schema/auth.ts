import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* Postgres 18 ships uuidv7(): time-ordered UUIDs, so primary keys append to the
   right of the B-tree instead of scattering across it like uuidv4 does. */
const id = () =>
  uuid()
    .primaryKey()
    .default(sql`uuidv7()`);

const now = () => timestamp({ withTimezone: true }).notNull().defaultNow();

export const userRole = pgEnum("user_role", ["user", "teacher", "admin"]);
export const localeEnum = pgEnum("locale", ["uz", "en", "ru"]);
export const themeEnum = pgEnum("theme", ["dark", "light", "sepia"]);

export const authEventKind = pgEnum("auth_event_kind", [
  "signup",
  "login_success",
  "login_failure",
  "logout",
  "logout_all",
  "email_verified",
  "verification_resent",
  "password_reset_requested",
  "password_reset_completed",
  "password_changed",
  "account_locked",
  "account_deleted",
  "two_factor_enabled",
  "two_factor_disabled",
  "two_factor_failed",
  "two_factor_reset",
]);

/* ═══════════════════════════════════════════════════════════════════════════
   USERS
   Email + password is a hard product requirement. The app stays locked until
   the address is verified, so email_verified_at is the gate, not a nice-to-have.
   ═══════════════════════════════════════════════════════════════════════════ */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text().notNull(),
    emailVerifiedAt: timestamp({ withTimezone: true }),

    /* Nullable on purpose. An account is created the moment someone asks for a
       code, before they have proved the address and long before they choose a
       password — so between sign-up and the set-password step this is null.
       Anyone in that state can authenticate only by receiving a fresh code. */
    passwordHash: text(),
    role: userRole().notNull().default("user"),
    displayName: text(),

    /* Brute-force defence. Cleared on every successful login. */
    failedLoginCount: integer().notNull().default(0),
    lockedUntil: timestamp({ withTimezone: true }),

    createdAt: now(),
    updatedAt: now(),
  },
  (t) => [
    uniqueIndex("users_email_key").on(t.email),
    /* Emails are normalised to lowercase before they ever reach the database,
       so "Ali@x.com" and "ali@x.com" can never become two accounts. */
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "users_email_shape",
      sql`${t.email} ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'`,
    ),
    check("users_failed_login_count_sane", sql`${t.failedLoginCount} >= 0`),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   PROFILES — everything the user can change about how the app behaves
   ═══════════════════════════════════════════════════════════════════════════ */

export const profiles = pgTable("profiles", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  locale: localeEnum().notNull().default("uz"),
  theme: themeEnum().notNull().default("dark"),

  /* Every plan-day boundary is computed in this zone. Getting it wrong means
     someone's day rolls over at the wrong hour and their streak breaks. */
  timeZone: text().notNull().default("Asia/Tashkent"),

  preferredReciter: text().notNull().default("alafasy"),
  arabicFontScale: smallint().notNull().default(100),
  translationIds: text().array().notNull().default(sql`'{}'::text[]`),

  /* The hour they told us they would study. Reminders key off this. */
  studyTime: time(),
  remindersEnabled: boolean().notNull().default(true),

  /* The last local date a reminder went out, so one goes out per day and not
     one per hourly pass. Stored as the reader's own calendar day: "did they
     get today's" is a question about their Tuesday, not about UTC's. */
  remindedOn: date({ mode: "string" }),

  /* The weekly report, on by default and switchable off.
     Opt-out rather than opt-in: it reports on a promise the reader made, which
     is the one message a hifz app has standing to send unasked — and every
     copy of it carries the way to stop it. */
  weeklyEmail: boolean().notNull().default(true),

  /* The sound a milestone makes. On by default, because somebody who has just
     finished a page should hear that they have — but a hifz app is used in
     mosques, in lessons, and next to sleeping children, and a celebration that
     cannot be silenced is a celebration that gets the app closed. */
  celebrationSound: boolean().notNull().default(true),

  currentStreak: integer().notNull().default(0),
  longestStreak: integer().notNull().default(0),
  lastCompleteDate: timestamp({ withTimezone: true, mode: "string" }),

  onboardedAt: timestamp({ withTimezone: true }),
  createdAt: now(),
  updatedAt: now(),
});

/* ═══════════════════════════════════════════════════════════════════════════
   SESSIONS
   Opaque random token in an httpOnly cookie; only its SHA-256 is stored here.
   A database leak therefore hands nobody a usable session, and "sign out
   everywhere" is a single DELETE.
   ═══════════════════════════════════════════════════════════════════════════ */

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),

    userAgent: text(),
    ip: text(),

    /* When this session cleared the second factor.
     *
     * Null on an account with 2FA switched on means the password was right and
     * nothing else has been proved yet — the session exists, but every screen
     * behind the wall turns it away until this is set. Keeping it on the
     * session rather than in a separate half-login cookie means signing out
     * everywhere also revokes every half-finished login, and a session that
     * cleared 2FA on Tuesday does not have to do it again on Wednesday. */
    secondFactorAt: timestamp({ withTimezone: true }),

    createdAt: now(),
    lastSeenAt: now(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_key").on(t.tokenHash),
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   ONE-TIME TOKENS
   `email` is stored on the verification row so an email *change* can be
   verified against the new address before it replaces the old one.
   ═══════════════════════════════════════════════════════════════════════════ */

export const emailVerificationCodes = pgTable(
  "email_verification_codes",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /* The address being proved. Kept here so an email *change* is verified
       against the new address before it replaces the old one. */
    email: text().notNull(),

    /* HMAC-SHA256 of "userId:code" under AUTH_SECRET. A six-digit space is
       small, so the raw code is never stored and the user id is folded in to
       make one rainbow table useless across accounts. */
    codeHash: text().notNull(),

    attempts: smallint().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    lastSentAt: now(),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("email_verification_codes_hash_key").on(t.codeHash),
    index("email_verification_codes_user_id_idx").on(t.userId),
    check("email_verification_codes_attempts_sane", sql`${t.attempts} >= 0`),
  ],
);

export const passwordResetCodes = pgTable(
  "password_reset_codes",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text().notNull(),
    attempts: smallint().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    lastSentAt: now(),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("password_reset_codes_hash_key").on(t.codeHash),
    index("password_reset_codes_user_id_idx").on(t.userId),
    check("password_reset_codes_attempts_sane", sql`${t.attempts} >= 0`),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   THE SECOND FACTOR
   A second password, not a phone. Most of the people this is built for do not
   have an authenticator app and would lose a recovery sheet; what they do have
   is the inbox they signed up with, which is why every way back in runs
   through it.
   ═══════════════════════════════════════════════════════════════════════════ */

export const twoFactorPurpose = pgEnum("two_factor_purpose", ["enable", "reset"]);

export const twoFactors = pgTable("two_factors", {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  /* Argon2, exactly as the account password is. It is a password; it gets a
     password's storage. */
  passwordHash: text().notNull(),

  enabledAt: now(),

  /* Wrong answers, and the cool-off they earn. Separate from the account's own
     lockout so a forgotten second factor cannot lock somebody out of the
     account itself — the way back is a code to the inbox either way. */
  failedCount: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true }),

  updatedAt: now(),
});

export const twoFactorCodes = pgTable(
  "two_factor_codes",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /* Turning it on and getting back in are different acts with different
       consequences, so they are never interchangeable codes. */
    purpose: twoFactorPurpose().notNull(),
    codeHash: text().notNull(),
    attempts: smallint().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    lastSentAt: now(),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("two_factor_codes_hash_key").on(t.codeHash),
    index("two_factor_codes_user_id_idx").on(t.userId),
    check("two_factor_codes_attempts_sane", sql`${t.attempts} >= 0`),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   PUSH SUBSCRIPTIONS
   One row per device, not per person: somebody signed in on a phone and a
   laptop wants the morning reminder on the phone, and both are equally valid
   places to be told a juz is finished.
   ═══════════════════════════════════════════════════════════════════════════ */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /* The push service's own URL for this device. Unique, because a browser
       that re-subscribes hands back the same endpoint and must update the row
       rather than accumulate copies of it. */
    endpoint: text().notNull(),
    /* The two keys the payload is encrypted to. Useless without the endpoint,
       and useless to us for anything but sending. */
    p256dh: text().notNull(),
    auth: text().notNull(),

    userAgent: text(),

    /* When the push service last refused this endpoint. A 404 or 410 means the
       browser threw the subscription away — the row goes with it. */
    failedAt: timestamp({ withTimezone: true }),

    createdAt: now(),
    lastSentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_key").on(t.endpoint),
    index("push_subscriptions_user_id_idx").on(t.userId),
  ],
);

/* ═══════════════════════════════════════════════════════════════════════════
   AUTH EVENTS — the audit trail the admin dashboard reads
   userId is nullable: a failed login against an unknown address still matters.
   ═══════════════════════════════════════════════════════════════════════════ */

export const authEvents = pgTable(
  "auth_events",
  {
    id: id(),
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    email: text(),
    kind: authEventKind().notNull(),
    ip: text(),
    userAgent: text(),
    detail: text(),
    createdAt: now(),
  },
  (t) => [
    index("auth_events_user_id_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("auth_events_kind_created_at_idx").on(t.kind, t.createdAt.desc()),
    index("auth_events_email_idx").on(t.email),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type EmailVerificationCode = typeof emailVerificationCodes.$inferSelect;
