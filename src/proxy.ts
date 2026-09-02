import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { SESSION_COOKIE } from "@/auth/cookie";
import { SESSION_TTL_DAYS } from "@/auth/constants";

// Next 16 renamed the middleware file convention to `proxy`. next-intl's
// factory is unchanged — only the filename moved.
const intl = createMiddleware(routing);

/**
 * Locale routing, and the sliding half of the session.
 *
 * A session lasts three days *without use*, and keeping that promise takes two
 * things agreeing: the row in `sessions`, which is extended when it is read,
 * and the cookie, which is not. A cookie's lifetime is fixed at the moment it
 * is set, so one written at sign-in would expire three days later however
 * faithfully its owner turned up every morning — and the database row would
 * still be valid, pointing at a token the browser had already thrown away.
 *
 * Re-stamping it here is the cheapest possible fix: no database call, no change
 * to the token, only a later expiry on a cookie that was already present. A
 * request without the cookie is left completely alone.
 */
export default async function proxy(request: NextRequest) {
  /* Awaited: next-intl's middleware is async, and treating its promise as a
     response leaves `response.cookies` undefined. */
  const response = await intl(request);

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 86_400,
    });
  }

  return response;
}

export const config = {
  // Run on every path except Next internals, the API, and anything that looks
  // like a file (fonts, images, the mushaf page fonts, recitation audio).
  //
  // The doubled backslash is load-bearing: `\\.` is an escaped backslash in a
  // JS string, which reaches the regex engine as `\.` — a literal dot. Written
  // as `\.` in the source it collapses to a bare `.`, the lookahead becomes
  // "any character at all", and the middleware then skips every path with
  // something after the slash. That is every page on the site except the
  // landing page, and they all 404.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
