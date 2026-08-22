import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/**
 * `redirect()` signals by throwing, but next-intl types it as returning void.
 * That makes TypeScript demand an unreachable `return` after every call and
 * stops it from narrowing values that are provably non-null afterwards. This
 * wrapper states the truth once, so call sites stay clean.
 */
export function redirectTo(href: string, locale: string): never {
  redirect({ href, locale });
  throw new Error(`redirect(${href}) returned instead of throwing`);
}
