import "server-only";

import { and, count, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { authEvents } from "@/db/schema";
import { AuthError } from "./errors";
import type { RequestContext } from "./session";

/**
 * Rate limiting on top of the audit log we already write.
 *
 * No Redis, no extra service: `auth_events` is indexed on (kind, created_at)
 * and on email, and one COUNT against a small recent window is cheap. If this
 * ever becomes the bottleneck it can move to Vercel KV without any caller
 * changing, because the whole surface is the two functions below.
 */

type Kind = (typeof authEvents.kind.enumValues)[number];

type Bucket = {
  kind: Kind;
  /** Sliding window, in minutes. */
  windowMinutes: number;
  /** Attempts allowed per IP inside the window. */
  perIp?: number;
  /** Attempts allowed per email address inside the window. */
  perEmail?: number;
};

export const BUCKETS = {
  signup: { kind: "signup", windowMinutes: 60, perIp: 5 },
  login: { kind: "login_failure", windowMinutes: 15, perIp: 20, perEmail: 10 },
  resend: { kind: "verification_resent", windowMinutes: 60, perEmail: 5 },
  reset: { kind: "password_reset_requested", windowMinutes: 60, perIp: 10, perEmail: 3 },
} satisfies Record<string, Bucket>;

async function countSince(
  kind: Kind,
  windowMinutes: number,
  column: "ip" | "email",
  value: string,
) {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const [row] = await db
    .select({ n: count() })
    .from(authEvents)
    .where(
      and(
        eq(authEvents.kind, kind),
        gte(authEvents.createdAt, since),
        eq(column === "ip" ? authEvents.ip : authEvents.email, value),
      ),
    );
  return row?.n ?? 0;
}

/**
 * Throws `rateLimited` when a bucket is exhausted.
 *
 * Deliberately checks the email bucket first: it is the one that protects a
 * specific account, and it is the one an attacker cannot escape by rotating
 * addresses.
 */
export async function enforceRateLimit(
  bucket: Bucket,
  ctx: RequestContext,
  email?: string,
) {
  if (bucket.perEmail && email) {
    const used = await countSince(bucket.kind, bucket.windowMinutes, "email", email);
    if (used >= bucket.perEmail) {
      throw new AuthError("rateLimited", { minutes: bucket.windowMinutes });
    }
  }

  if (bucket.perIp && ctx.ip) {
    const used = await countSince(bucket.kind, bucket.windowMinutes, "ip", ctx.ip);
    if (used >= bucket.perIp) {
      throw new AuthError("rateLimited", { minutes: bucket.windowMinutes });
    }
  }
}

/** Append to the audit log. Never throws — logging must not break a flow. */
export async function recordAuthEvent(input: {
  kind: Kind;
  userId?: string | null;
  email?: string | null;
  ctx?: RequestContext;
  detail?: string;
}) {
  try {
    await db.insert(authEvents).values({
      kind: input.kind,
      userId: input.userId ?? null,
      email: input.email ?? null,
      ip: input.ctx?.ip ?? null,
      userAgent: input.ctx?.userAgent ?? null,
      detail: input.detail ?? null,
    });
  } catch (error) {
    console.error("[auth] failed to record event", input.kind, error);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACCOUNT LOCKOUT
   Separate from rate limiting: rate limits protect the service, lockout
   protects one account. The delay escalates so a slow, distributed guessing
   attack gets slower the longer it runs.
   ═══════════════════════════════════════════════════════════════════════════ */

export const LOCKOUT_THRESHOLD = 5;

export function lockoutMinutes(failedCount: number): number {
  if (failedCount < LOCKOUT_THRESHOLD) return 0;
  const step = failedCount - LOCKOUT_THRESHOLD;
  return Math.min(60 * 24, [15, 60, 240, 720, 1440][Math.min(step, 4)]);
}

export function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60_000));
}

export const nowSql = sql`now()`;
