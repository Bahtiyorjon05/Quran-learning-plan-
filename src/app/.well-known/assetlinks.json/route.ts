import { env } from "@/lib/env";

/**
 * Digital Asset Links — the file that lets an Android app claim this origin.
 *
 * A Trusted Web Activity is the Play Store wrapper for a site like this one:
 * the store ships a thin Android app that opens Ahd full-screen, with no
 * browser bar and no "running in Chrome" banner. Android only removes that
 * banner if the site vouches for the app, and this is where it does so — the
 * app is named by its package and by the SHA-256 of the certificate Play signs
 * it with.
 *
 * Served from a route rather than a static file so the fingerprints come from
 * the environment. Play re-signs uploads with its own key, so the fingerprint
 * that matters is the one Play shows *after* the first release, not the one
 * from the local keystore — putting it in the repository would mean a commit
 * every time it changed and a wrong file until then.
 *
 * With TWA_FINGERPRINTS unset this answers with an empty list, which is the
 * truthful answer: no app is authorised to speak for this origin yet.
 */

export const dynamic = "force-dynamic";

const PACKAGE = "app.ahd.quran";

export function GET() {
  const fingerprints = (env.TWA_FINGERPRINTS ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    /* Play prints them as colon-separated hex pairs; anything else is a
       mistyped value and would silently break verification. */
    .filter((value) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(value));

  const statements =
    fingerprints.length === 0
      ? []
      : [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: PACKAGE,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];

  return Response.json(statements, {
    headers: {
      "content-type": "application/json",
      /* Android fetches this rarely and caches hard; an hour is enough to make
         a correction land the same day without hammering the function. */
      "cache-control": "public, max-age=3600",
    },
  });
}
