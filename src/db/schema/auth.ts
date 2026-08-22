import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    passwordHash: text().notNull(),
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

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("email_verification_tokens_hash_key").on(t.tokenHash),
    index("email_verification_tokens_user_id_idx").on(t.userId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: now(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_hash_key").on(t.tokenHash),
    index("password_reset_tokens_user_id_idx").on(t.userId),
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
