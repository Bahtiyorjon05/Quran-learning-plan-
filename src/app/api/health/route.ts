import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { activeTransport } from "@/email/mailer";

export const dynamic = "force-dynamic";

/**
 * Liveness and pairing check.
 *
 * Beyond "is it up", this reports how long a round trip to Postgres actually
 * takes from the function. That number is the whole reason the database sits in
 * Frankfurt and `vercel.json` pins functions to `fra1` — if it ever climbs past
 * ~30ms, the two have drifted apart and every page in the app got slower.
 *
 * Deliberately says nothing about the database host, the schema or the
 * environment: it is a public endpoint.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    await db.execute(sql`select 1`);
    const dbLatencyMs = Date.now() - startedAt;

    return Response.json(
      {
        ok: true,
        region: process.env.VERCEL_REGION ?? "local",
        dbLatencyMs,
        mail: activeTransport(),
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        at: new Date().toISOString(),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] database unreachable:", error);
    return Response.json(
      { ok: false, region: process.env.VERCEL_REGION ?? "local" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
