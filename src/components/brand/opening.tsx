"use client";

import { useTranslations } from "next-intl";

import { AhdMark } from "./logo";

/**
 * What Ahd shows while it is opening.
 *
 * An installed app launches into whatever the operating system paints from the
 * manifest, and then into whatever the page renders — and the dashboard is
 * server-rendered, so between the two there was a black rectangle. On a phone
 * over a slow connection that gap is the first thing anyone sees each morning,
 * and it looked like the app had failed to start.
 *
 * So: the seal, lit, with the name of the thing under it. Deliberately the
 * same ground, the same lattice and the same gold as the app it precedes, so
 * the splash resolves into the dashboard rather than being replaced by it.
 *
 * Nothing here is a spinner. A spinner says "something is wrong and I am
 * counting"; a seal that breathes says "this is Ahd, and it is coming".
 */
export function Opening() {
  const t = useTranslations("meta");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      role="status"
      aria-live="polite"
      /* Emerald, and the same emerald the launcher tile and the system splash
         are painted in, so the sequence from home screen to opened app is one
         surface deepening rather than three different darks. The page ground
         it finally settles into is the bottom of this gradient. */
      style={{
        background:
          "linear-gradient(165deg, #0e5c4a 0%, #0b483a 38%, #08342a 68%, var(--surface-base) 100%)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Light from above, as on the landing page — the seal is lit rather
            than merely placed. */}
        <div
          className="absolute start-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--color-emerald-300) 26%, transparent), transparent 68%)",
          }}
        />
        <div className="girih absolute inset-0 opacity-[0.06]" />
        {/* The grain that stops a large gradient banding into visible steps. */}
        <div className="ahd-grain absolute inset-0" />
      </div>

      <div className="animate-rise relative flex flex-col items-center px-6 text-center">
        <span className="relative grid place-items-center">
          {/* A halo on the same slow breath as the covenant arc. */}
          <span
            aria-hidden
            className="animate-breathe absolute h-32 w-32 rounded-full blur-2xl"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--gold) 40%, transparent), transparent 70%)",
            }}
          />
          <AhdMark size={92} priority className="relative" />
        </span>

        <p className="mt-7 font-[family-name:var(--font-display)] text-[1.5rem] leading-tight font-light text-[#f2f6f4] sm:text-[1.75rem]">
          {t("tagline")}
        </p>

        {/* A hairline that fills, rather than a spinner that turns. */}
        <span
          aria-hidden
          className="mt-7 block h-px w-40 overflow-hidden rounded-full bg-[color-mix(in_oklab,#f2f6f4_22%,transparent)]"
        >
          <span className="ahd-opening-sweep block h-full w-1/3 rounded-full bg-[var(--color-gold-300)]" />
        </span>
      </div>
    </div>
  );
}
