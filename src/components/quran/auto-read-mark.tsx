"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { useLocalValue, writeLocal } from "@/lib/client-store";
import { cn } from "@/lib/utils";

/**
 * Marks a page read once the reader has actually reached the end of it.
 *
 * There is no button for this any more, and there was not much point in one:
 * it asked the reader to record something the page already knew.
 *
 * "Read" and "memorised" are deliberately different things, and only one of
 * them can be inferred:
 *
 *   read       you got to the bottom of the page. The browser can see that, so
 *              it is recorded for you — nobody should have to tap a button for
 *              something the page already knows.
 *
 *   memorised  you hold it by heart. Nothing on a screen can tell that, and
 *              guessing would corrupt the covenant's progress and the revision
 *              schedule with it. That stays a deliberate act, taken on the
 *              signed-in reader, and nothing here touches it.
 *
 * It measures where the end of the page *is* rather than waiting to be told it
 * came into view. An IntersectionObserver was the obvious way to do this and
 * silently missed the case that matters: jump from the top of the page to the
 * bottom in one movement — a flick on a phone, End on a keyboard — and the
 * element never gets sampled while it is on screen, so nothing ever fires.
 * Reading the geometry on each scroll frame cannot miss, however you arrived.
 */

const READ_KEY = "ahd-pages-read";

/** A page shorter than the window needs a moment before it counts as read. */
const DWELL_MS = 4000;

function parsePages(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function storedPages(): number[] {
  try {
    return parsePages(localStorage.getItem(READ_KEY));
  } catch {
    return [];
  }
}

export function AutoReadMark({ page }: { page: number }) {
  const t = useTranslations("quran.reader");

  const raw = useLocalValue(READ_KEY);
  const read = useMemo(() => new Set(parsePages(raw)), [raw]);
  const already = read.has(page);

  const [justMarked, setJustMarked] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (already) return;

    const end = endRef.current;
    if (!end) return;

    const openedAt = Date.now();
    let done = false;
    let frame = 0;

    function mark() {
      if (done) return;
      done = true;

      const next = new Set(storedPages());
      next.add(page);
      writeLocal(READ_KEY, JSON.stringify([...next].sort((a, b) => a - b)));
      setJustMarked(true);
    }

    function check() {
      frame = 0;
      if (done || !end) return;

      /* Has the end of the text reached the screen? Measured now, so it is
         true whether it scrolled past slowly or arrived in one jump. */
      const reached = end.getBoundingClientRect().top <= window.innerHeight;
      if (!reached) return;

      /* A page that fits entirely in the window is "reached" the instant it
         loads. Marking it read before anyone could have read it would be a
         lie, so that case waits. */
      const scrollable = document.documentElement.scrollHeight > window.innerHeight + 40;
      if (!scrollable && Date.now() - openedAt < DWELL_MS) return;

      mark();
    }

    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(check);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    check();
    /* For the short page: come back once the dwell has passed. */
    const timer = window.setTimeout(check, DWELL_MS + 50);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [page, already]);

  return (
    <>
      <div ref={endRef} aria-hidden className="h-px w-full" />

      {/* Said once, briefly, and only when it was this visit that did it: a
          page that changed state silently behind you is unsettling, and this
          is the only sign that anything happened. */}
      {justMarked && (
        <p
          role="status"
          className={cn(
            "animate-rise mx-auto mt-6 flex w-fit items-center gap-2 rounded-full",
            "border border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]",
            "px-4 py-2 text-[0.8125rem] text-[var(--accent-strong)]",
          )}
        >
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
          {t("autoMarked")}
        </p>
      )}
    </>
  );
}
