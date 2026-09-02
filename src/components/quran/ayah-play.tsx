"use client";

import { Play } from "lucide-react";

/**
 * Recite from this verse.
 *
 * Before this, listening began at the top of the page and the only way to hear
 * the fourth ayah was to sit through the first three. The one thing a person
 * memorising actually wants is *this* verse, again — so it is one tap from the
 * verse itself.
 *
 * It tells the player by dispatching an event rather than by lifting state.
 * The Arabic is server-rendered and must never re-render — that is the whole
 * reason the reciting verse is marked with a DOM attribute instead of React
 * state — and threading a callback down to six hundred verses would undo it.
 */
export function AyahPlay({ ayahKey, label }: { ayahKey: string; label: string }) {
  return (
    <button
      type="button"
      data-ayah-play={ayahKey}
      aria-label={label}
      title={label}
      onClick={() =>
        document.dispatchEvent(new CustomEvent("ahd-play-ayah", { detail: ayahKey }))
      }
      className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-faint)] transition-[color,border-color,background-color] duration-300 hover:border-[var(--accent)]/50 hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <Play className="h-3 w-3 translate-x-px" strokeWidth={2} />
    </button>
  );
}
