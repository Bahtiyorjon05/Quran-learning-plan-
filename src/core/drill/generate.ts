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

import {
  displayWords,
  normalizeArabic,
  normalizedWords,
  similarity,
} from "@/core/quran/arabic";

import { pick, rngFrom, sampleIndices, shuffle, type Rng } from "./random";
import type {
  AyahRef,
  BankWord,
  Choice,
  Drill,
  DrillMode,
  Question,
  SourceAyah,
} from "./types";

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
   * Every ayah of the surahs this page touches, for choosing distractors.
   *
   * The page alone is a bad pool. Asked where a passage from Al-Baqara sits,
   * the only other verses available were the nine or ten sharing its page —
   * which is how 2:6 came to be offered against 2:10 and 2:11, neither of
   * which shares a word with it. Given the surah, the drill can put up verses
   * that could genuinely be mistaken for it.
   *
   * Optional, and the page is used when it is absent: the module stays pure
   * and the caller decides how much to load.
   */
  pool?: SourceAyah[];
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
          ? firstWordQuestions(input, rng)
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
  if (input.ayahs.some((a) => continuationOf(a) !== null)) modes.push("firstWord");
  if (input.ayahs.length >= 2) modes.push("next", "shuffle");
  if (confusablePairs(input).length > 0) modes.push("mutashabihat");

  return modes;
}

/* ── assembling an ayah from its words ────────────────────────────────────── */

/**
 * How many decoys sit in the bank alongside the real words.
 *
 * Three. Fewer and a bank of only the right words becomes a pure ordering
 * puzzle solvable by elimination; many more and the drill turns into visual
 * search, which is a different skill from hifz.
 */
const DECOYS = 3;

/** The first-word prompt asks for a bounded continuation, not a whole page. */
const MAX_CONTINUATION = 8;

/**
 * Build an assemble question: the ayah with some words lifted out, and a bank
 * to tap them back from.
 *
 * The bank is shuffled, so the order the words are given in says nothing.
 */
function assemble(
  ayah: SourceAyah,
  mode: "hide" | "gap" | "firstWord",
  words: string[],
  blanks: number[],
  input: GenerateInput,
  rng: Rng,
  truncated = false,
): Question {
  const missing = blanks.map((i) => words[i]);
  const bank: BankWord[] = missing.map((text, i) => ({ id: `w${i}`, text }));

  for (const [i, text] of decoysFor(ayah, missing, words, input, rng).entries()) {
    bank.push({ id: `d${i}`, text });
  }

  return {
    kind: "assemble",
    mode,
    ref: refOf(ayah),
    words: words.map((text, i) => ({ text, hidden: blanks.includes(i) })),
    blanks,
    bank: shuffle(bank, rng),
    truncated,
  };
}

/**
 * Plausible wrong words.
 *
 * Drawn first from the passage this one is confused with, because that is the
 * mistake actually waiting to be made, then from the ayah's own visible words
 * and its neighbours on the page. Anything matching a word the question is
 * asking for is skipped — a decoy that is secretly a right answer makes the
 * bank incoherent to look at.
 */
function decoysFor(
  ayah: SourceAyah,
  missing: string[],
  own: string[],
  input: GenerateInput,
  rng: Rng,
): string[] {
  const forbidden = new Set(missing.map(normalizeArabic));
  const chosen: string[] = [];
  const seen = new Set<string>();

  const consider = (word: string) => {
    if (chosen.length >= DECOYS) return;
    const key = normalizeArabic(word);
    if (key.length < 2 || forbidden.has(key) || seen.has(key)) return;
    seen.add(key);
    chosen.push(word);
  };

  for (const partner of input.confusable?.[ayah.k] ?? []) {
    if (partner.t) for (const word of shuffle(displayWords(partner.t), rng)) consider(word);
  }

  for (const word of shuffle(own, rng)) consider(word);

  for (const other of shuffle(input.ayahs, rng)) {
    if (other.k === ayah.k) continue;
    for (const word of shuffle(displayWords(other.t), rng)) consider(word);
  }

  return chosen;
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

      return assemble(ayah, "hide", words, blanks, input, rng);
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

      return assemble(ayah, "gap", words, [index], input, rng);
    });
}

/* ── first word ───────────────────────────────────────────────────────────── */

/**
 * The opening is given; the continuation is rebuilt word by word.
 *
 * The hardest of the modes, because nothing of the answer is on screen — only
 * where it starts. Bounded to a handful of words so a long ayah does not turn
 * into forty taps; the point is whether the thread is held, not stamina.
 */
function firstWordQuestions(input: GenerateInput, rng: Rng): Question[] {
  const out: Question[] = [];

  for (const ayah of input.ayahs) {
    if (out.length >= MAX_QUESTIONS) break;

    const plan = continuationOf(ayah);
    if (!plan) continue;

    /* Everything past the last asked-for word is elided rather than shown, so
       the ayah does not give away its own ending. */
    const last = plan.asked[plan.asked.length - 1];
    const words = plan.all.slice(0, last + 1);

    out.push(
      assemble(ayah, "firstWord", words, plan.asked, input, rng, last < plan.all.length - 1),
    );
  }

  return out;
}

/**
 * What to show and what to ask for, or null if the ayah is too short to ask.
 *
 * The lead is normally one word, or two when the first is a bare particle —
 * "wa" alone is no prompt at all. But a two-word ayah like عَمَّ يَتَسَآءَلُونَ
 * opens with exactly such a particle, and taking two words there leaves nothing
 * to ask for. Walking the mushaf found four of them; the lead now yields rather
 * than swallowing the whole ayah.
 */
function continuationOf(ayah: SourceAyah) {
  const all = displayWords(ayah.t);
  const askable = blankableIndices(all);
  if (askable.length < 2) return null;

  const wanted = normalizeArabic(all[0] ?? "").length <= 2 ? 2 : 1;

  for (const lead of wanted === 2 ? [2, 1] : [1]) {
    const asked = askable.filter((i) => i >= lead).slice(0, MAX_CONTINUATION);
    if (asked.length > 0) return { all, asked };
  }

  return null;
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
/**
 * How many places to choose between.
 *
 * Two was not a question, it was a coin. Four is the smallest number that asks
 * the reciter to actually know where the passage sits.
 */
const MUTASHABIHAT_CHOICES = 4;

function mutashabihatQuestions(input: GenerateInput, rng: Rng): Question[] {
  return confusablePairs(input)
    .slice(0, MAX_QUESTIONS)
    .map(({ ayah, partners }) => {
      const answer: Choice = { id: ayah.k, text: "", ref: refOf(ayah) };
      const distractors: Choice[] = placesToConfuseWith(ayah, partners, input, rng).map(
        (place) => ({ id: place.k, text: "", ref: refOf(place) }),
      );

      return {
        kind: "choice" as const,
        mode: "mutashabihat" as const,
        ref: refOf(ayah),
        prompt: ayah.t,
        /* The choices are references, not text — the text is what is being
           shown, so offering it again would give the answer away. Naming is
           left to the caller, which has the surah names in the right language.

           Listed in the order they occur in the mushaf rather than shuffled.
           These are places, and a list of places that jumps 2:6, 2:11, 2:10
           looks like an accident; in order it reads as a list of somewhere this
           passage could be. The answer's position is still unpredictable,
           because it depends on where its neighbours fall. */
        choices: [answer, ...distractors].sort(
          (a, b) => (a.ref!.s - b.ref!.s) || (a.ref!.a - b.ref!.a),
        ),
        answerId: ayah.k,
      };
    });
}

/**
 * The other places this passage might be, chosen so the surah is not the tell.
 *
 * A passage from Al-Baqara offered against Ya-Sin is answered by recognising
 * the surah, which is not the skill being tested — the difficulty of
 * mutashabihat is *which verse of the same surah* it was. So the true
 * confusable partners come first, those within the surah before those outside
 * it, and if none of them shares the surah then one neighbour from it is
 * brought in deliberately, to take that shortcut away.
 *
 * Partners from other surahs are still offered: they are the real thing, the
 * pairs a hafiz actually slips between. They just may not be the only choices.
 */
function placesToConfuseWith(
  ayah: SourceAyah,
  partners: (AyahRef & { score: number; t?: string })[],
  input: GenerateInput,
  rng: Rng,
): AyahRef[] {
  const wanted = MUTASHABIHAT_CHOICES - 1;
  const seen = new Set([ayah.k]);
  const picked: AyahRef[] = [];

  const add = (candidates: AyahRef[]) => {
    for (const candidate of candidates) {
      if (picked.length >= wanted) return;
      if (seen.has(candidate.k)) continue;
      seen.add(candidate.k);
      picked.push(refOf(candidate));
    }
  };

  const here = partners.filter((partner) => partner.s === ayah.s);
  const elsewhere = partners.filter((partner) => partner.s !== ayah.s);

  /* The rest of the surah, ranked by how much it actually resembles the
     passage rather than by how close it happens to sit.
   *
   * This is the difference between a question and a formality. Offering 2:6
   * against 2:10 and 2:11 — its neighbours on the page, sharing not a word
   * with it — leaves one option anybody can pick by elimination. Ranking by
   * word overlap puts up the verses that could genuinely be mistaken for it,
   * which is the whole premise of the drill. */
  const target = normalizedWords(ayah.t);
  const alike = (input.pool ?? input.ayahs)
    .filter((other) => other.s === ayah.s && other.k !== ayah.k)
    .map((other) => ({ other, score: similarity(target, normalizedWords(other.t)) }))
    .sort((a, b) => b.score - a.score)
    .map((ranked) => ranked.other);

  /* If every real partner is in another surah, the likeliest verse of this one
     goes in first — otherwise the answer is "the surah it obviously is". */
  if (here.length === 0) add(alike.slice(0, 1));

  add(here);
  add(elsewhere);
  add(alike);
  /* Last resort, so a short surah still gets a full set of choices. */
  add(shuffle([...input.ayahs], rng));

  return picked;
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
