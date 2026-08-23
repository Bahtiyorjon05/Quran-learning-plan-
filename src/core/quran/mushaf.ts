/**
 * The mushaf, as numbers.
 *
 * Everything a plan reasons about — how much is left, what today's portion is,
 * which juz a page belongs to — is arithmetic over the Madani mushaf's 604
 * pages. This module is the single place that arithmetic lives, so a mistake
 * here is one mistake rather than fifty scattered ones.
 */

export const TOTAL_PAGES = 604;

/**
 * The working unit is the line, not the page.
 *
 * 604 pages ÷ 1095 days is 0.55 of a page, which is not something a person can
 * act on in the morning. 9060 lines ÷ 1095 days is 8 lines, which is. Every
 * plan is therefore measured in lines and only rendered as pages.
 */
export const LINES_PER_PAGE = 15;
export const TOTAL_LINES = TOTAL_PAGES * LINES_PER_PAGE; // 9060

/**
 * First page of each juz in the Madani mushaf.
 *
 * Juz 1 runs 1–21 and juz 30 runs 582–604; the twenty-eight between them are
 * exactly twenty pages each. 21 + 28×20 + 23 = 604.
 */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 122, 142, 162, 182, 202, 222, 242, 262, 282, 302, 322,
  342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

export const TOTAL_JUZ = JUZ_START_PAGES.length; // 30

function assertPage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > TOTAL_PAGES) {
    throw new RangeError(`Page out of range: ${page}`);
  }
  return page;
}

function assertJuz(juz: number): number {
  if (!Number.isInteger(juz) || juz < 1 || juz > TOTAL_JUZ) {
    throw new RangeError(`Juz out of range: ${juz}`);
  }
  return juz;
}

/** Which juz a page belongs to. */
export function juzOfPage(page: number): number {
  assertPage(page);
  // Small enough that a linear scan from the end is clearer than a bisection.
  for (let juz = TOTAL_JUZ; juz >= 1; juz--) {
    if (page >= JUZ_START_PAGES[juz - 1]) return juz;
  }
  return 1;
}

/** Inclusive page range of a juz. */
export function pagesOfJuz(juz: number): { from: number; to: number } {
  assertJuz(juz);
  return {
    from: JUZ_START_PAGES[juz - 1],
    to: juz === TOTAL_JUZ ? TOTAL_PAGES : JUZ_START_PAGES[juz] - 1,
  };
}

/** Inclusive page range spanning a run of juz. */
export function pagesOfJuzRange(fromJuz: number, toJuz: number) {
  assertJuz(fromJuz);
  assertJuz(toJuz);
  if (fromJuz > toJuz) throw new RangeError(`Juz range reversed: ${fromJuz}–${toJuz}`);
  return { from: pagesOfJuz(fromJuz).from, to: pagesOfJuz(toJuz).to };
}

/* ── Lines ────────────────────────────────────────────────────────────────
   Lines are numbered 1…9060 across the whole mushaf, so a sabaq is a pair of
   integers rather than a page-and-offset tuple that has to be normalised
   everywhere it is used.

   Every page is treated as fifteen lines. The opening pages genuinely hold
   fewer, but a plan measures effort rather than ink, and a uniform page keeps
   the arithmetic invertible — which the redistribution maths depends on. When
   the Qur'an data pipeline lands with real per-page line counts, only this
   file changes.                                                             */

export function firstLineOfPage(page: number): number {
  return (assertPage(page) - 1) * LINES_PER_PAGE + 1;
}

export function lastLineOfPage(page: number): number {
  return assertPage(page) * LINES_PER_PAGE;
}

export function pageOfLine(line: number): number {
  if (!Number.isInteger(line) || line < 1 || line > TOTAL_LINES) {
    throw new RangeError(`Line out of range: ${line}`);
  }
  return Math.floor((line - 1) / LINES_PER_PAGE) + 1;
}

/** Total lines in an inclusive page range. */
export function linesInPages(fromPage: number, toPage: number): number {
  assertPage(fromPage);
  assertPage(toPage);
  if (fromPage > toPage) throw new RangeError(`Page range reversed: ${fromPage}–${toPage}`);
  return (toPage - fromPage + 1) * LINES_PER_PAGE;
}

/** Pages touched by an inclusive line range, for marking progress. */
export function pagesInLines(fromLine: number, toLine: number): number[] {
  const first = pageOfLine(fromLine);
  const last = pageOfLine(toLine);
  if (first > last) throw new RangeError(`Line range reversed: ${fromLine}–${toLine}`);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * How a line range reads to a person: "page 78" or "pages 78–80".
 * Formatting of the words themselves belongs to the UI; this is the shape.
 */
export function describeLineRange(fromLine: number, toLine: number) {
  const first = pageOfLine(fromLine);
  const last = pageOfLine(toLine);
  return {
    fromPage: first,
    toPage: last,
    singlePage: first === last,
    fromLineOnPage: ((fromLine - 1) % LINES_PER_PAGE) + 1,
    toLineOnPage: ((toLine - 1) % LINES_PER_PAGE) + 1,
    lines: toLine - fromLine + 1,
  };
}
