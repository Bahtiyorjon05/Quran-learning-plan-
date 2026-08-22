import { notFound } from "next/navigation";

/**
 * Catches every unmatched path so it lands inside the [locale] layout.
 *
 * Without this, an unknown URL never resolves a locale segment, so Next falls
 * back to its own built-in 404 — plain, unstyled, and in English regardless of
 * the language the visitor is reading. Routing through here means
 * [locale]/not-found.tsx renders instead, translated and in the app's skin.
 *
 * A catch-all has the lowest routing priority, so every real page still wins.
 */
export default function CatchAllNotFound() {
  notFound();
}
