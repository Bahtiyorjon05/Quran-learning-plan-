import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { getCurrentUser } from "@/auth/session";

/**
 * A device saying where to reach it.
 *
 * The endpoint is unique, so a browser that re-subscribes — which it does
 * after a permission change, a reinstall, or a key rotation — updates its row
 * instead of leaving a dead one behind and adding a live one beside it.
 */
/**
 * The hosts a push endpoint may live on.
 *
 * Without this, `z.string().url()` accepted anything — and every reminder run
 * would then have the server make a POST to whatever address a signed-up
 * account had registered, including addresses inside its own network. A push
 * endpoint always belongs to the browser vendor's service, so the set is
 * small, closed, and worth naming.
 */
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
];

function isPushEndpoint(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return PUSH_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
  );
}

const schema = z.object({
  endpoint: z.string().url().max(1000).refine(isPushEndpoint, "not a push service"),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(200) }),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await db
    .insert(pushSubscriptions)
    .values({
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get("user-agent"),
    })
    /* The endpoint moves to whoever is signed in now. It identifies a browser
       profile, not a person, and on a shared device the last person to sign in
       is the one whose reminders should arrive on it. */
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: user.id,
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent: request.headers.get("user-agent"),
        failedAt: null,
      },
    });

  return NextResponse.json({ ok: true });
}

/** Turning it off on this device, without touching the others. */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const parsed = z
    .object({ endpoint: z.string().url() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, user.id),
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
      ),
    );

  return NextResponse.json({ ok: true });
}
