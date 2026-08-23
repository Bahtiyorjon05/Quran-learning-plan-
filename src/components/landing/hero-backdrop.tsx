/**
 * The ground behind the hero.
 *
 * Four layers, none of them decoration for its own sake:
 *
 *   1. Aurora — three soft lights drifting on different periods, so the page
 *      is never quite still and never obviously moving. Emerald and gold, the
 *      two brand colours, at the size and blur of dawn through a window.
 *   2. Girih — a real eight-fold Islamic tessellation, drawn stroke by stroke
 *      the first time the page loads. A static texture says "we chose a
 *      pattern"; a drawn one says "this was made". It draws once and stops.
 *   3. Rays — a faint fan from above, which is what makes the lattice read as
 *      lit rather than printed.
 *   4. Grain — the thing that keeps large flat gradients from banding on cheap
 *      screens, and the reason the whole composition looks like paper rather
 *      than like CSS.
 *
 * Everything here is inert: no scripts, no images to download, one inline SVG.
 * All motion is disabled under prefers-reduced-motion in the stylesheet.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* ── 1. Aurora ── */}
      <div className="ahd-aurora ahd-aurora-a" />
      <div className="ahd-aurora ahd-aurora-b" />
      <div className="ahd-aurora ahd-aurora-c" />

      {/* ── 2. The lattice, drawing itself ── */}
      <svg
        className="ahd-lattice absolute start-1/2 top-[-6rem] h-[52rem] w-[64rem] -translate-x-1/2 sm:h-[60rem] sm:w-[80rem]"
        viewBox="0 0 800 600"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Fades the pattern out at the edges so it never ends in a hard
              line — the tile is square, the impression should not be. */}
          <radialGradient id="ahd-lattice-fade" cx="50%" cy="34%" r="62%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="ahd-lattice-mask">
            <rect width="800" height="600" fill="url(#ahd-lattice-fade)" />
          </mask>

          {/* One tile of the eight-fold pattern: the star, the square it sits
              in, and the straps that carry it into the next tile. */}
          <pattern id="ahd-girih" width="100" height="100" patternUnits="userSpaceOnUse">
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M50 4 L96 50 L50 96 L4 50 Z" />
              <path d="M50 18 L82 50 L50 82 L18 50 Z" />
              <path d="M28 28 L72 72 M72 28 L28 72" />
              <circle cx="50" cy="50" r="13" />
              <path d="M0 0 L28 28 M100 0 L72 28 M0 100 L28 72 M100 100 L72 72" />
            </g>
          </pattern>
        </defs>

        <g mask="url(#ahd-lattice-mask)" className="text-[var(--texture)]">
          <rect width="800" height="600" fill="url(#ahd-girih)" opacity="0.07" />
        </g>
      </svg>

      {/* ── 3. Light from above ── */}
      <div className="ahd-rays absolute inset-x-0 top-0 h-[34rem]" />

      {/* ── 4. Grain, and the fade into the page ── */}
      <div className="ahd-grain absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(to_bottom,transparent,var(--surface-base))]" />
    </div>
  );
}
