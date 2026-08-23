/**
 * Reading the tajweed markup, and naming what it marks.
 *
 * The source ships the same Uthmani text with rules bracketed inline:
 *
 *   بِسْمِ [h:1[ٱ]للَّهِ [h:2[ٱ][l[ل]رَّحْمَ[n[ـٰ]نِ
 *
 * A span is `[rule:id[text]` — the id is a running number the source uses and
 * nothing here needs. One span in the whole mushaf, at 32:3, is unlabelled:
 * `ٱفْتَرَ[ٮٰ]هُ`. That is a quirk of the data rather than a rule, so it parses
 * to a plain segment and colours like ordinary text.
 *
 * Parsing never alters a letter. The segments concatenated back together are
 * the ayah, exactly — a test asserts it for all 6236.
 */

export type TajweedRule =
  | "hamzatWasl"
  | "silent"
  | "lamShamsiyyah"
  | "maddNormal"
  | "maddPermissible"
  | "maddNecessary"
  | "maddObligatory"
  | "qalqalah"
  | "ghunnah"
  | "ikhfa"
  | "ikhfaShafawi"
  | "idghamShafawi"
  | "idghamGhunnah"
  | "idghamNoGhunnah"
  | "idghamMutajanisayn"
  | "idghamMutaqaribayn"
  | "maddLazim";

/**
 * The single letters the source uses, and what each one means.
 *
 * All seventeen appear in the shipped text; a test checks this table against
 * the codes the build recorded, so a code arriving with no entry is caught
 * rather than rendering as unstyled text.
 */
export const RULE_CODES: Record<string, TajweedRule> = {
  h: "hamzatWasl",
  s: "silent",
  l: "lamShamsiyyah",
  n: "maddNormal",
  p: "maddPermissible",
  m: "maddNecessary",
  o: "maddObligatory",
  w: "maddLazim",
  q: "qalqalah",
  g: "ghunnah",
  i: "ikhfa",
  c: "ikhfaShafawi",
  f: "idghamShafawi",
  a: "idghamGhunnah",
  u: "idghamNoGhunnah",
  d: "idghamMutajanisayn",
  b: "idghamMutaqaribayn",
};

/**
 * Which rules share a colour.
 *
 * Seventeen distinct colours would be unreadable and would say nothing — a
 * reader cannot hold seventeen keys in mind. Grouping by what the mouth
 * actually does leaves six, which is a legend someone can learn in a sitting.
 */
export type TajweedFamily = "madd" | "ghunnah" | "idgham" | "ikhfa" | "qalqalah" | "silent";

export const RULE_FAMILY: Record<TajweedRule, TajweedFamily> = {
  maddNormal: "madd",
  maddPermissible: "madd",
  maddNecessary: "madd",
  maddObligatory: "madd",
  maddLazim: "madd",

  ghunnah: "ghunnah",

  idghamGhunnah: "idgham",
  idghamNoGhunnah: "idgham",
  idghamShafawi: "idgham",
  idghamMutajanisayn: "idgham",
  idghamMutaqaribayn: "idgham",

  ikhfa: "ikhfa",
  ikhfaShafawi: "ikhfa",

  qalqalah: "qalqalah",

  /* Both are about a letter that is written but not sounded. */
  silent: "silent",
  hamzatWasl: "silent",
  lamShamsiyyah: "silent",
};

export type TajweedSegment = {
  text: string;
  /** null for ordinary text carrying no rule. */
  rule: TajweedRule | null;
};

/* `[rule:id[` or `[rule[` or a bare `[`, and `]`. */
const TOKEN = /\[([a-z]+)(?::\d+)?\[|\[|\]/g;

/**
 * Split marked-up text into coloured and uncoloured runs.
 *
 * Spans in this data do not nest, but a stray close bracket in a future edition
 * must not corrupt the text, so an unmatched `]` simply ends the current span
 * and an unclosed span runs to the end of the ayah. Either way every character
 * survives.
 */
export function parseTajweed(marked: string): TajweedSegment[] {
  if (!marked) return [];

  const segments: TajweedSegment[] = [];
  let cursor = 0;
  let rule: TajweedRule | null = null;

  const push = (text: string, on: TajweedRule | null) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.rule === on) last.text += text;
    else segments.push({ text, rule: on });
  };

  TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN.exec(marked)) !== null) {
    push(marked.slice(cursor, match.index), rule);
    cursor = match.index + match[0].length;

    if (match[0] === "]") rule = null;
    else rule = match[1] ? (RULE_CODES[match[1]] ?? null) : null;
  }

  push(marked.slice(cursor), rule);
  return segments;
}

/** The ayah without its markup — what the segments spell out together. */
export function stripTajweed(marked: string): string {
  return parseTajweed(marked)
    .map((segment) => segment.text)
    .join("");
}
