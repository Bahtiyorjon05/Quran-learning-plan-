/**
 * Turning a page of the Qur'an into active recall.
 *
 * Reading a page again is the least effective way to revise it and the way
 * almost everyone does it, because it feels fluent. Every mode here removes
 * something and asks for it back, which feels worse and works better.
 *
 * The generators are pure: given the same ayahs and the same seed they produce
 * the same drill, which is what lets the server grade an answer without having
 * stored the question.
 */

import { displayWords, normalizeArabic } from "@/core/quran/arabic";

import { pick, rngFrom, sampleIndices, shuffle, type Rng } from "./random";
import type { AyahRef, Choice, Drill, DrillMode, Question, SourceAyah } from "./types";

/** Ayahs shorter than this have nothing to hide. */
const MIN_WORDS_FOR_HIDING = 3;

/**
 * Which tokens of an ayah can honestly be asked for.
 *
 * The Uthmani text carries standalone recitation marks — the small seen of
 * 2:2's ۛ ... ۛ among them — and they are separate tokens. They normalise to
 * nothing, so a blank hiding one cannot be answered correctly even by someone
 * who types it exactly: the grader would compare "" against "" and reject the
 * empty answer. They are displayed, never asked for.
 */
function blankableIndices(words: readonly string[]): number[] {
  const out: number[] = [];
  words.forEach((word, index) => {
    if (normalizeArabic(word).length > 0) out.push(index);
  });
  return out;
}

/** An ayah worth hiding words in — counted in askable words, not tokens. */
function canHide(ayah: SourceAyah): boolean {
  return blankableIndices(displayWords(ayah.t)).length >= MIN_WORDS_FOR_HIDING;
}

/** Never ask for more than this in one sitting; a drill should be finishable. */
export const MAX_QUESTIONS = 10;

export type GenerateInput = {
  page: number;
  /** Every ayah on the page, in order. */
  ayahs: SourceAyah[];
  /**
   * Confusable partners for the page's ayahs, keyed by ayah.
   *
   * Supplied by the caller rather than loaded here, so this module stays free
   * of imports that only exist on the server.
   */
  confusable?: Record<string, (AyahRef & { score: number; t?: string })[]>;
  /**
   * How far through the drill's difficulty the reciter is, 0 to 1.
   *
   * Only the hide mode uses it, where the whole point is that the same passage
   * is asked for again with more of it missing.
   */
  level?: number;
  seed: number;
};

export function generateDrill(mode: DrillMode, input: GenerateInput): Drill {
  const rng = rngFrom(input.seed);

  const questions =
    mode === "hide"
      ? hideQuestions(input, rng)
      : mode === "gap"
        ? gapQuestions(input, rng)
        : mode === "firstWord"
          ? firstWordQuestions(input)
          : mode === "next"
            ? nextQuestions(input, rng)
            : mode === "shuffle"
              ? shuffleQuestions(input, rng)
              : mutashabihatQuestions(input, rng);

  return { mode, page: input.page, questions };
}

/**
 * Which modes this page can actually support.
 *
 * A page holding one long ayah cannot be shuffled, and a page whose ayahs have
 * no confusable partner has no duel to offer. Asking anyway would produce an
 * empty drill, so the caller is told in advance.
 */
export function availableModes(input: GenerateInput): DrillMode[] {
  const modes: DrillMode[] = [];
  const longEnough = input.ayahs.filter(canHide);

  if (longEnough.length > 0) modes.push("hide", "gap");
  if (input.ayahs.length > 0) modes.push("firstWord");
  if (input.ayahs.length >= 2) modes.push("next", "shuffle");
  if (confusablePairs(input).length > 0) modes.push("mutashabihat");

  return modes;
}

/* ── progressive hide ─────────────────────────────────────────────────────── */

/**
 * The same passage, with more of it missing each round.
 *
 * This is how hifz is actually taught: recite looking, then recite with the
 * page half covered, then with it closed. The level drives the proportion
 * hidden, so round one removes a fifth and the last round removes nearly
 * everything.
 */
function hideQuestions(input: GenerateInput, rng: Rng): Question[] {
  const level = clamp01(input.level ?? 0);
  const proportion = 0.2 + level * 0.65;

  return input.ayahs
    .filter(canHide)
    .slice(0, MAX_QUESTIONS)
    .map((ayah) => {
      const words = displayWords(ayah.t);
      const askable = blankableIndices(words);

      /* Always at least one blank, and never every askable word — something has
         to remain for the eye to start from. */
      const count = Math.max(
        1,
        Math.min(askable.length - 1, Math.round(askable.length * proportion)),
      );
      const blanks = sampleIndices(askable.length, count, rng).map((i) => askable[i]);

      return {
        kind: "reveal" as const,
        mode: "hide" as const,
        ref: refOf(ayah),
        words: words.map((text, i) => ({ text, hidden: blanks.includes(i) })),
        blanks,
      };
    });
}

/* ── fill the gap ─────────────────────────────────────────────────────────── */

/**
 * One word removed, and it is never a filler.
 *
 * Blanking "wa" or "min" tests nothing; the words worth asking for are the ones
 * that carry the ayah. Short function words are skipped when the ayah has
 * anything longer to offer.
 */
function gapQuestions(input: GenerateInput, rng: Rng): Question[] {
  return input.ayahs
    .filter(canHide)
    .slice(0, MAX_QUESTIONS)
    .map((ayah) => {
      const words = displayWords(ayah.t);

      const substantial = words
        .map((word, index) => ({ index, length: normalizeArabic(word).length }))
        .filter((w) => w.length >= 4)
        .map((w) => w.index);

      /* Falls back to any word with letters in it, never to a bare mark. */
      const candidates = substantial.length > 0 ? substantial : blankableIndices(words);
      const index = pick(candidates, rng);

      return {
        kind: "reveal" as const,
        mode: "gap" as const,
        ref: refOf(ayah),
        words: words.map((text, i) => ({ text, hidden: i === index })),
        blanks: [index],
      };
    });
}

/* ── first word ───────────────────────────────────────────────────────────── */

/** The opening is given; the rest is recited from memory. */
function firstWordQuestions(input: GenerateInput): Question[] {
  return input.ayahs.slice(0, MAX_QUESTIONS).map((ayah) => {
    const words = displayWords(ayah.t);
    /* Two words when the first is a single particle, which on its own is no
       prompt at all — a great many ayahs begin with "wa". */
    const lead = normalizeArabic(words[0] ?? "").length <= 2 ? 2 : 1;

    return {
      kind: "recall" as const,
      mode: "firstWord" as const,
      ref: refOf(ayah),
      prompt: words.slice(0, lead).join(" "),
      answer: words.slice(lead).join(" ") || ayah.t,
    };
  });
}

/* ── what comes next ──────────────────────────────────────────────────────── */

/**
 * Given an ayah, which one follows.
 *
 * The distractors are what make this worth doing. Ayahs drawn at random from
 * elsewhere are rejected on sight; the ones offered here are the neighbours on
 * the same page and, when the answer has one, its confusable twin — the
 * passage a reciter would actually slip into.
 */
function nextQuestions(input: GenerateInput, rng: Rng): Question[] {
  const questions: Question[] = [];

  for (let i = 0; i < input.ayahs.length - 1 && questions.length < MAX_QUESTIONS; i++) {
    const current = input.ayahs[i];
    const answer = input.ayahs[i + 1];

    const distractors = distractorsFor(answer, input, rng, 3);
    if (distractors.length === 0) continue;

    const answerChoice: Choice = { id: answer.k, text: excerpt(answer.t), ref: refOf(answer) };

    questions.push({
      kind: "choice",
      mode: "next",
      ref: refOf(current),
      prompt: excerpt(current.t),
      choices: shuffle([answerChoice, ...distractors], rng),
      answerId: answer.k,
    });
  }

  return questions;
}

/* ── ayah shuffle ─────────────────────────────────────────────────────────── */

/**
 * A run of ayahs, out of order.
 *
 * Four at a time: enough that the order is not obvious, few enough that the
 * task is about sequence rather than short-term memory.
 */
function shuffleQuestions(input: GenerateInput, rng: Rng): Question[] {
  const RUN = 4;
  const questions: Question[] = [];

  for (let start = 0; start + 1 < input.ayahs.length && questions.length < MAX_QUESTIONS; start += RUN) {
    const run = input.ayahs.slice(start, start + RUN);
    if (run.length < 2) break;

    const choices: Choice[] = run.map((ayah) => ({
      id: ayah.k,
      text: excerpt(ayah.t),
      ref: refOf(ayah),
    }));

    /* A shuffle that happens to land in order is not a question. */
    let shuffled = shuffle(choices, rng);
    for (let tries = 0; tries < 8 && sameOrder(shuffled, choices); tries++) {
      shuffled = shuffle(choices, rng);
    }
    if (sameOrder(shuffled, choices)) shuffled = [...choices].reverse();

    questions.push({
      kind: "order",
      mode: "shuffle",
      refs: run.map(refOf),
      shuffled,
      answerIds: choices.map((c) => c.id),
    });
  }

  return questions;
}

/* ── the mutashabihat duel ────────────────────────────────────────────────── */

/**
 * Which of these near-identical places is this one.
 *
 * The hardest thing in hifz and the thing almost no application addresses: two
 * passages differing by a letter, and no way to tell them apart except knowing
 * where each belongs. The passage is shown and the reciter names it.
 */
function mutashabihatQuestions(input: GenerateInput, rng: Rng): Question[] {
  return confusablePairs(input)
    .slice(0, MAX_QUESTIONS)
    .map(({ ayah, partners }) => {
      const answer: Choice = { id: ayah.k, text: "", ref: refOf(ayah) };
      const distractors: Choice[] = partners
        .slice(0, 3)
        .map((partner) => ({ id: partner.k, text: "", ref: refOf(partner) }));

      return {
        kind: "choice" as const,
        mode: "mutashabihat" as const,
        ref: refOf(ayah),
        prompt: ayah.t,
        /* The choices are references, not text — the text is what is being
           shown, so offering it again would give the answer away. Naming is
           left to the caller, which has the surah names in the right language. */
        choices: shuffle([answer, ...distractors], rng),
        answerId: ayah.k,
      };
    });
}

function confusablePairs(input: GenerateInput) {
  const table = input.confusable;
  if (!table) return [];

  return input.ayahs
    .map((ayah) => ({ ayah, partners: table[ayah.k] ?? [] }))
    .filter((entry) => entry.partners.length > 0);
}

/* ── shared ───────────────────────────────────────────────────────────────── */

function distractorsFor(
  answer: SourceAyah,
  input: GenerateInput,
  rng: Rng,
  count: number,
): Choice[] {
  const seen = new Set([answer.k]);
  const out: Choice[] = [];

  /* The confusable twin first: it is the mistake actually waiting to be made. */
  for (const partner of input.confusable?.[answer.k] ?? []) {
    if (seen.has(partner.k) || !partner.t) continue;
    seen.add(partner.k);
    out.push({ id: partner.k, text: excerpt(partner.t), ref: refOf(partner) });
    if (out.length >= count) return out;
  }

  for (const other of shuffle(input.ayahs, rng)) {
    if (seen.has(other.k)) continue;
    seen.add(other.k);
    out.push({ id: other.k, text: excerpt(other.t), ref: refOf(other) });
    if (out.length >= count) break;
  }

  return out;
}

/** The opening of an ayah, so a choice list stays readable. */
function excerpt(text: string, words = 8): string {
  const all = displayWords(text);
  return all.length <= words ? text : `${all.slice(0, words).join(" ")} …`;
}

function refOf(ayah: AyahRef): AyahRef {
  return { k: ayah.k, s: ayah.s, a: ayah.a, p: ayah.p };
}

function sameOrder(a: Choice[], b: Choice[]): boolean {
  return a.every((choice, i) => choice.id === b[i].id);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
