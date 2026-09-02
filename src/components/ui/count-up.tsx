"use client";

import * as React from "react";

/**
 * A number that arrives rather than appears.
 *
 * Used only where the number is the point — pages held, days banked, per cent
 * memorized. Counting a figure up is a cliché when it decorates something
 * trivial and it is right here, because these numbers are the reward for
 * months of work and the eye should be made to rest on them for a moment.
 *
 * Three rules keep it honest:
 *  - the final value is in the DOM from the first render, so it is correct for
 *    a crawler, for a screen reader, and for anyone with JavaScript off;
 *  - `prefers-reduced-motion` skips straight to the end;
 *  - it runs once, when the number is actually on screen, and never again.
 */
export function CountUp({
  value,
  duration = 1100,
  decimals = 0,
  grouped = false,
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  /** Thin-space thousands, the way large figures are set on this site. */
  grouped?: boolean;
  className?: string;
}) {
  const show = React.useCallback(
    (n: number) => {
      const text = n.toFixed(decimals);
      return grouped ? text.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : text;
    },
    [decimals, grouped],
  );
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      value === 0
    ) {
      return;
    }

    let frame = 0;
    let started = false;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        /* Ease out; the number should decelerate into place, not stop dead. */
        const eased = 1 - Math.pow(1 - t, 3);
        node.textContent = show(value * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
        else node.textContent = show(value);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || started) return;
        started = true;
        observer.disconnect();
        run();
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration, decimals, show]);

  return (
    <span ref={ref} className={className}>
      {show(value)}
    </span>
  );
}
