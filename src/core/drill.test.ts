import { describe, expect, it } from "vitest";

import { normalizeArabic } from "./quran/arabic";
import { generateDrill, availableModes, MAX_QUESTIONS } from "./drill/generate";
import { markDrill, markQuestion, missedRefs, type Answer } from "./drill/grade";
import { rngFrom, sampleIndices, seedFrom, shuffle } from "./drill/random";
import {
  DRILL_MODES,
  questionCount,
  type DrillMode,
  type Question,
  type SourceAyah,
} from "./drill/types";

/* Real text, because a fixture of invented Arabic would not exercise the
   normalisation this whole module depends on. Al-Baqara 1–5, page 2. */
const PAGE: SourceAyah[] = [
  { k: "2:1", s: 2, a: 1, p: 2, t: "الٓمٓ" },
  {
    k: "2:2",
    s: 2,
    a: 2,
    p: 2,
    t: "ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ",
  },
  {
    k: "2:3",
    s: 2,
    a: 3,
    p: 2,
    t: "ٱلَّذِينَ يُؤْمِنُونَ بِٱلْغَيْبِ وَيُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ",
  },
  {
    k: "2:4",
    s: 2,
    a: 4,
    p: 2,
    t: "وَٱلَّذِينَ يُؤْمِنُونَ بِمَآ أُنزِلَ إِلَيْكَ وَمَآ أُنزِلَ مِن قَبْلِكَ وَبِٱلْـَٔاخِرَةِ هُمْ يُوقِنُونَ",
  },
  {
    k: "2:5",
    s: 2,
    a: 5,
    p: 2,
    t: "أُو۟لَٰٓئِكَ عَلَىٰ هُدًۭى مِّن رَّبِّهِمْ ۖ وَأُو۟لَٰٓئِكَ هُمُ ٱلْمُفْلِحُونَ",
  },
];

const CONFUSABLE = {
  "2:3": [
    {
      k: "8:3",
      s: 8,
      a: 3,
      p: 177,
      score: 0.8,
      t: "ٱلَّذِينَ يُقِيمُونَ ٱلصَّلَوٰةَ وَمِمَّا رَزَقْنَٰهُمْ يُنفِقُونَ",
    },
  ],
};

const base = { page: 2, ayahs: PAGE, confusable: CONFUSABLE, seed: seedFrom("test") };

/** Answer every question exactly right, the way a reciter who knows it would. */
function perfect(questions: readonly Question[]): Answer[] {
  return questions.map((question) => {
    switch (question.kind) {
      case "assemble": {
        const spent = new Set<string>();
        return {
          kind: "assemble",
          placed: question.blanks.map((wordIndex) => {
            const wanted = question.words[wordIndex].text;
            const word = question.bank.find((w) => w.text === wanted && !spent.has(w.id));
            if (word) spent.add(word.id);
            return word?.id ?? null;
          }),
        };
      }
      case "choice":
        return { kind: "choice", choiceId: question.answerId };
      case "order":
        return { kind: "order", choiceIds: question.answerIds };
    }
  });
}

describe("seeded randomness", () => {
  it("gives the same sequence for the same seed", () => {
    const a = rngFrom(7);
    const b = rngFrom(7);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it("gives different sequences for different seeds", () => {
    expect(rngFrom(1)()).not.toBe(rngFrom(2)());
  });

  it("stays inside [0, 1)", () => {
    const rng = rngFrom(123);
    for (let i = 0; i < 5000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("shuffles without losing or duplicating anything", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const out = shuffle(items, rngFrom(9));
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 50 }, (_, i) => i)); // not mutated
  });

  it("samples distinct indices and never spins", () => {
    for (const [length, count] of [
      [10, 3],
      [10, 10],
      [10, 99],
      [1, 5],
    ]) {
      const out = sampleIndices(length, count, rngFrom(3));
      expect(new Set(out).size).toBe(out.length);
      expect(out.length).toBe(Math.min(length, count));
      expect(out.every((i) => i >= 0 && i < length)).toBe(true);
      expect([...out]).toEqual([...out].sort((a, b) => a - b));
    }
  });
});

describe("generating a drill", () => {
  it("produces the same drill twice from the same seed", () => {
    for (const mode of DRILL_MODES) {
      const first = generateDrill(mode, base);
      const second = generateDrill(mode, base);
      expect(second).toEqual(first);
    }
  });

  it("offers every mode this page can support", () => {
    const modes = availableModes(base);
    expect(modes).toContain("hide");
    expect(modes).toContain("next");
    expect(modes).toContain("shuffle");
    expect(modes).toContain("mutashabihat");
  });

  it("does not offer the duel when nothing on the page is confusable", () => {
    expect(availableModes({ ...base, confusable: {} })).not.toContain("mutashabihat");
  });

  it("does not offer sequence modes for a single-ayah page", () => {
    const modes = availableModes({ ...base, ayahs: [PAGE[1]], confusable: {} });
    expect(modes).not.toContain("next");
    expect(modes).not.toContain("shuffle");
  });

  it("never asks more than a sitting's worth", () => {
    const long: SourceAyah[] = Array.from({ length: 60 }, (_, i) => ({
      ...PAGE[1],
      k: `2:${i + 10}`,
      a: i + 10,
    }));
    for (const mode of DRILL_MODES) {
      const drill = generateDrill(mode, { ...base, ayahs: long });
      expect(drill.questions.length).toBeLessThanOrEqual(MAX_QUESTIONS);
    }
  });

  it("never alters the text it displays", () => {
    /* Normalisation is for comparison only. A mark lost here is a mark lost
       from the Qur'an on someone's screen. */
    const drill = generateDrill("hide", base);
    for (const question of drill.questions) {
      if (question.kind !== "assemble") continue;
      const rebuilt = question.words.map((w) => w.text).join(" ");
      const original = PAGE.find((a) => a.k === question.ref.k)!.t;
      expect(rebuilt).toBe(original.split(/\s+/).filter(Boolean).join(" "));
    }
  });
});

describe("progressive hide", () => {
  it("hides more as the level rises", () => {
    const hidden = (level: number) =>
      generateDrill("hide", { ...base, level }).questions.reduce(
        (n, q) => n + (q.kind === "assemble" ? q.blanks.length : 0),
        0,
      );
    expect(hidden(1)).toBeGreaterThan(hidden(0));
  });

  it("always leaves something visible and always asks for something", () => {
    for (const level of [0, 0.25, 0.5, 0.75, 1, 2, -1]) {
      for (const question of generateDrill("hide", { ...base, level }).questions) {
        if (question.kind !== "assemble") continue;
        expect(question.blanks.length).toBeGreaterThan(0);
        expect(question.blanks.length).toBeLessThan(question.words.length);
      }
    }
  });

  it("never blanks a bare recitation mark", () => {
    /* 2:2 carries two standalone ۛ marks, which are their own tokens and
       normalise to nothing. Hiding one produces a blank that cannot be answered
       correctly even by typing it exactly — the grader rejects an empty answer.
       Walking all 604 pages found this; the five-ayah fixture alone did not. */
    for (const level of [0, 0.5, 1]) {
      for (const question of generateDrill("hide", { ...base, level }).questions) {
        if (question.kind !== "assemble") continue;
        for (const blank of question.blanks) {
          expect(normalizeArabic(question.words[blank].text).length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("skips ayahs too short to hide anything in", () => {
    // 2:1 is الٓمٓ — one word, nothing to remove.
    const refs = generateDrill("hide", base).questions.map((q) =>
      q.kind === "assemble" ? q.ref.k : "",
    );
    expect(refs).not.toContain("2:1");
  });
});

describe("fill the gap", () => {
  it("removes exactly one word", () => {
    for (const question of generateDrill("gap", base).questions) {
      expect(question.kind).toBe("assemble");
      if (question.kind !== "assemble") continue;
      expect(question.blanks).toHaveLength(1);
      expect(question.words.filter((w) => w.hidden)).toHaveLength(1);
    }
  });

  it("prefers a word that carries the ayah over a particle", () => {
    /* Blanking "min" or "wa" tests nothing. */
    for (const question of generateDrill("gap", base).questions) {
      if (question.kind !== "assemble") continue;
      const word = question.words[question.blanks[0]].text;
      expect(normalizeArabic(word).length).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("first word", () => {
  it("gives a real prompt even when the ayah opens with a particle", () => {
    /* 2:4 begins with wa-alladhina; a one-word prompt there is no prompt. */
    const question = generateDrill("firstWord", base).questions.find(
      (q) => q.kind === "assemble" && q.ref.k === "2:4",
    );
    if (question?.kind !== "assemble") throw new Error("expected an assemble question");

    const shown = question.words.filter((_, i) => !question.blanks.includes(i));
    expect(normalizeArabic(shown.map((w) => w.text).join(" ")).length).toBeGreaterThan(2);
    expect(question.blanks.length).toBeGreaterThan(0);
  });

  it("asks for a bounded continuation rather than a whole long ayah", () => {
    /* Forty taps is stamina, not hifz. */
    for (const question of generateDrill("firstWord", base).questions) {
      if (question.kind !== "assemble") continue;
      expect(question.blanks.length).toBeLessThanOrEqual(8);
    }
  });

  it("elides whatever it did not ask for, rather than showing the ending", () => {
    for (const question of generateDrill("firstWord", base).questions) {
      if (question.kind !== "assemble") continue;
      const source = PAGE.find((a) => a.k === question.ref.k)!;
      const total = source.t.split(/\s+/).filter(Boolean).length;
      if (question.words.length < total) expect(question.truncated).toBe(true);
      /* The last word shown is always one the question asks for, so nothing
         beyond the final blank is given away. */
      expect(question.blanks).toContain(question.words.length - 1);
    }
  });

  it("skips an ayah with nothing to continue into", () => {
    // 2:1 is الٓمٓ — one word, so there is no continuation to ask for.
    const refs = generateDrill("firstWord", base).questions.map((q) =>
      q.kind === "assemble" ? q.ref.k : "",
    );
    expect(refs).not.toContain("2:1");
    expect(availableModes({ ...base, ayahs: [PAGE[0]] })).not.toContain("firstWord");
  });
});

describe("what comes next", () => {
  it("asks for the ayah that actually follows", () => {
    for (const question of generateDrill("next", base).questions) {
      if (question.kind !== "choice") continue;
      const current = PAGE.findIndex((a) => a.k === question.ref.k);
      expect(question.answerId).toBe(PAGE[current + 1].k);
    }
  });

  it("always includes the right answer among the choices", () => {
    for (const question of generateDrill("next", base).questions) {
      if (question.kind !== "choice") continue;
      expect(question.choices.map((c) => c.id)).toContain(question.answerId);
    }
  });

  it("offers no duplicate choices", () => {
    for (const question of generateDrill("next", base).questions) {
      if (question.kind !== "choice") continue;
      const ids = question.choices.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("uses the confusable twin as a distractor when there is one", () => {
    /* 8:3 is the trap for 2:3, and offering random ayahs instead would make the
       question answerable without knowing anything. */
    const question = generateDrill("next", base).questions.find(
      (q) => q.kind === "choice" && q.answerId === "2:3",
    );
    if (question?.kind !== "choice") throw new Error("expected a question ending at 2:3");
    expect(question.choices.map((c) => c.id)).toContain("8:3");
  });
});

describe("ayah shuffle", () => {
  it("never presents the run already in order", () => {
    for (let seed = 0; seed < 40; seed++) {
      for (const question of generateDrill("shuffle", { ...base, seed }).questions) {
        if (question.kind !== "order") continue;
        expect(question.shuffled.map((c) => c.id)).not.toEqual(question.answerIds);
      }
    }
  });

  it("presents exactly the ayahs it asks to be ordered", () => {
    for (const question of generateDrill("shuffle", base).questions) {
      if (question.kind !== "order") continue;
      expect([...question.shuffled.map((c) => c.id)].sort()).toEqual([...question.answerIds].sort());
    }
  });

  it("puts the answer in mushaf order", () => {
    for (const question of generateDrill("shuffle", base).questions) {
      if (question.kind !== "order") continue;
      const positions = question.answerIds.map((id) => PAGE.findIndex((a) => a.k === id));
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});

describe("the mutashabihat duel", () => {
  it("shows the passage and offers its confusable twins as choices", () => {
    const drill = generateDrill("mutashabihat", base);
    expect(drill.questions.length).toBeGreaterThan(0);

    for (const question of drill.questions) {
      if (question.kind !== "choice") continue;
      expect(question.prompt).toBe(PAGE.find((a) => a.k === question.ref.k)!.t);
      expect(question.choices.map((c) => c.id)).toContain("8:3");
      expect(question.answerId).toBe(question.ref.k);
    }
  });

  it("does not give the answer away in the choice text", () => {
    /* The passage is on screen; repeating it as a choice would answer the
       question for the reciter. Choices carry references only. */
    for (const question of generateDrill("mutashabihat", base).questions) {
      if (question.kind !== "choice") continue;
      expect(question.choices.every((c) => c.text === "")).toBe(true);
      expect(question.choices.every((c) => c.ref !== undefined)).toBe(true);
    }
  });
});

describe("marking", () => {
  const gap = generateDrill("gap", base).questions[0];
  if (gap.kind !== "assemble") throw new Error("expected an assemble question");

  const missingWord = gap.words[gap.blanks[0]].text;
  const rightId = gap.bank.find((w) => w.text === missingWord)!.id;
  const wrongId = gap.bank.find((w) => w.text !== missingWord)!.id;

  it("accepts the word that was asked for", () => {
    expect(markQuestion(gap, { kind: "assemble", placed: [rightId] }).correct).toBe(1);
  });

  it("rejects a decoy", () => {
    const mark = markQuestion(gap, { kind: "assemble", placed: [wrongId] });
    expect(mark.correct).toBe(0);
    expect(mark.wrongAt).toEqual([0]);
  });

  it("rejects an empty slot", () => {
    expect(markQuestion(gap, { kind: "assemble", placed: [null] }).correct).toBe(0);
  });

  it("judges by the word, not by which token was tapped", () => {
    /* An ayah can say the same word twice, and the bank then holds two entries
       for it. Tapping either into either slot is right; marking by id would
       fail a reciter who was correct. */
    const twice: SourceAyah = {
      k: "9:9", s: 9, a: 9, p: 9,
      t: "قُلْ هُوَ ٱللَّهُ أَحَدٌ ٱللَّهُ ٱلصَّمَدُ",
    };
    const drill = generateDrill("hide", {
      ...base, ayahs: [twice], confusable: {}, level: 1,
    });
    const question = drill.questions[0];
    if (question.kind !== "assemble") throw new Error("expected an assemble question");

    /* Place the *last* matching bank entry into each slot rather than the
       first, so ids deliberately do not line up. */
    const placed = question.blanks.map((i) => {
      const wanted = question.words[i].text;
      const matches = question.bank.filter((w) => w.text === wanted);
      return matches[matches.length - 1].id;
    });

    const mark = markQuestion(question, { kind: "assemble", placed });
    expect(mark.correct).toBe(mark.total);
  });

  it("marks a missing answer wrong rather than throwing", () => {
    const mark = markQuestion(gap, null);
    expect(mark.correct).toBe(0);
    expect(mark.wrongAt).toEqual([0]);
  });

  it("marks an answer of the wrong shape wrong rather than throwing", () => {
    expect(markQuestion(gap, { kind: "choice", choiceId: "2:3" }).correct).toBe(0);
  });

  it("ignores an id that is not in the bank", () => {
    expect(markQuestion(gap, { kind: "assemble", placed: ["nonsense"] }).correct).toBe(0);
  });

  it("marks an ordering position by position", () => {
    const question = generateDrill("shuffle", base).questions[0];
    if (question.kind !== "order") throw new Error("expected order");

    expect(markQuestion(question, { kind: "order", choiceIds: question.answerIds }).correct).toBe(
      question.answerIds.length,
    );

    const swapped = [...question.answerIds];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const mark = markQuestion(question, { kind: "order", choiceIds: swapped });
    expect(mark.correct).toBe(question.answerIds.length - 2);
    expect(mark.wrongAt).toEqual([0, 1]);
  });

  it("never lets hints exceed what was asked", () => {
    const mark = markQuestion(gap, { kind: "assemble", placed: [rightId], hints: 99 });
    expect(mark.hints).toBeLessThanOrEqual(mark.total);
  });

  it("totals a whole drill and reports where it went wrong", () => {
    const drill = generateDrill("gap", base);
    const answers = perfect(drill.questions).map((answer, i) => {
      // Get the first one wrong on purpose.
      if (i !== 0) return answer;
      const question = drill.questions[0];
      if (question.kind !== "assemble") return answer;
      const decoy = question.bank.find(
        (w) => w.text !== question.words[question.blanks[0]].text,
      )!;
      return { kind: "assemble" as const, placed: [decoy.id] };
    });

    const result = markDrill(drill.questions, answers);
    expect(result.total).toBe(questionCount(drill));
    expect(result.correct).toBe(result.total - 1);
    expect(result.accuracy).toBeCloseTo((result.total - 1) / result.total);

    const missed = missedRefs(drill.questions, result.marks);
    expect(missed).toHaveLength(1);
    expect(missed[0].k).toBe(
      drill.questions[0].kind === "assemble" ? drill.questions[0].ref.k : "",
    );
    expect(missed[0].wordIndex).not.toBeNull();
  });

  it("gives full marks to an attempt that answers everything exactly", () => {
    /* The invariant a whole-mushaf walk exists to protect: if a perfect attempt
       can score less than full, some question is unanswerable. */
    for (const mode of DRILL_MODES) {
      const drill = generateDrill(mode, base);
      const result = markDrill(drill.questions, perfect(drill.questions));
      expect(`${mode}: ${result.correct}/${result.total}`).toBe(
        `${mode}: ${result.total}/${result.total}`,
      );
    }
  });

  it("scores a drill nobody answered as zero without throwing", () => {
    for (const mode of DRILL_MODES) {
      const drill = generateDrill(mode, base);
      const result = markDrill(drill.questions, []);
      expect(result.correct).toBe(0);
      expect(result.accuracy).toBe(0);
    }
  });

  it("agrees with what the drill said it would ask", () => {
    for (const mode of DRILL_MODES as readonly DrillMode[]) {
      const drill = generateDrill(mode, base);
      expect(markDrill(drill.questions, []).total).toBe(questionCount(drill));
    }
  });

  it("never asks anyone to type Arabic", () => {
    /* The point of the rework: every answer is a tap. If a question shape ever
       needs free text again, this fails and says so. */
    for (const mode of DRILL_MODES) {
      for (const question of generateDrill(mode, base).questions) {
        expect(["assemble", "choice", "order"]).toContain(question.kind);
        if (question.kind === "assemble") {
          expect(question.bank.length).toBeGreaterThanOrEqual(question.blanks.length);
        }
      }
    }
  });
});
