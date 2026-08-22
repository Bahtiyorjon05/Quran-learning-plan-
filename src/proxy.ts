import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

// Next 16 renamed the middleware file convention to `proxy`. next-intl's
// factory is unchanged — only the filename moved.
export default createMiddleware(routing);

export const config = {
  // Run on every path except Next internals, the API, and anything that looks
  // like a file (fonts, images, the mushaf page fonts, recitation audio).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
