/**
 * Checks the practice engine against the real mushaf, not a fixture.
 *
 * The unit tests use five ayahs of Al-Baqara. That proves the generators are
 * correct; it does not prove they survive contact with all 604 pages — the
 * page that is one ayah long, the page whose ayahs are all identical, the page
 * that straddles a juz boundary.
 *
 * The invariant that matters most is the round trip: a drill is shown from one
 * call and marked from another, so if those two ever disagreed every answer
 * would be graded against the wrong question, silently, for everyone.
 *
 *   npm run verify:practice
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

import { availableModes, generateDrill } from "../src/core/drill/generate";
import { seedFrom } from "../src/core/drill/random";
import { markDrill, type Answer } from "../src/core/drill/grade";
import { questionCount, type DrillMode } from "../src/core/drill/types";
import { TOTAL_PAGES } from "../src/core/quran/mushaf";
import { confusableOnPage, loadPage } from "../src/data/quran/loader";

type Failure = { page: number; mode: string; why: string };

const failures: Failure[] = [];

function check(condition: boolean, page: number, mode: string, why: string) {
  if (!condition) failures.push({ page, mode, why });
}

async function main() {
  console.log(`walking all ${TOTAL_PAGES} pages\n`);

  const modeCounts = new Map<string, number>();
  let pagesWithDuel = 0;
  let totalQuestions = 0;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const { ayahs } = await loadPage(page);
    check(ayahs.length > 0, page, "-", "no ayahs on the page");
    if (ayahs.length === 0) continue;

    const confusable = await confusableOnPage(ayahs);
    const input = {
      page,
      ayahs: ayahs.map((a) => ({ k: a.k, s: a.s, a: a.a, p: a.p, t: a.t })),
      confusable,
      seed: 0,
    };

    const modes = availableModes(input);
    check(modes.length > 0, page, "-", "no mode is possible on this page");
    if (modes.includes("mutashabihat")) pagesWithDuel++;

    for (const mode of modes) {
      modeCounts.set(mode, (modeCounts.get(mode) ?? 0) + 1);

      const level = mode === "hide" ? 0.5 : 0;
      const seed = seedFrom(`user:${page}:${mode}:${level}:`);

      /* Two independent calls, exactly as the page and the action make them. */
      const shown = generateDrill(mode as DrillMode, { ...input, level, seed });
      const marked = generateDrill(mode as DrillMode, { ...input, level, seed });

      check(
        JSON.stringify(shown) === JSON.stringify(marked),
        page,
        mode,
        "the drill shown and the drill marked are not identical",
      );

      check(shown.questions.length > 0, page, mode, "produced no questions");
      totalQuestions += shown.questions.length;

      for (const question of shown.questions) {
        /* Displayed text must be the Qur'an, untouched. */
        if (question.kind === "assemble") {
          const source = input.ayahs.find((a) => a.k === question.ref.k);
          check(Boolean(source), page, mode, `unknown ayah ${question.ref.k}`);
          const visible = question.words.map((w) => w.text).join(" ");
          const whole = source!.t.split(/\s+/).filter(Boolean).join(" ");
          /* The first-word prompt deliberately shows only as far as it asks,
             so it is a prefix rather than the whole ayah — but every character
             it does show must be the Qur'an's. */
          check(
            question.truncated ? whole.startsWith(visible) : visible === whole,
            page,
            mode,
            `text altered in ${question.ref.k}`,
          );

          /* Every blank must be fillable from the bank, or the question cannot
             be answered correctly by anyone. */
          const supply = new Map<string, number>();
          for (const word of question.bank) {
            supply.set(word.text, (supply.get(word.text) ?? 0) + 1);
          }
          for (const index of question.blanks) {
            const wanted = question.words[index].text;
            const left = supply.get(wanted) ?? 0;
            check(left > 0, page, mode, `no bank word for blank ${index} of ${question.ref.k}`);
            supply.set(wanted, left - 1);
          }
          check(question.blanks.length > 0, page, mode, `nothing hidden in ${question.ref.k}`);
          check(
            question.blanks.length < question.words.length,
            page,
            mode,
            `everything hidden in ${question.ref.k}`,
          );
        }

        if (question.kind === "choice") {
          const ids = question.choices.map((c) => c.id);
          check(ids.includes(question.answerId), page, mode, "the answer is not among the choices");
          check(new Set(ids).size === ids.length, page, mode, "duplicate choices");
          check(question.choices.length >= 2, page, mode, "fewer than two choices");
        }

        if (question.kind === "order") {
          check(
            question.shuffled.length === question.answerIds.length,
            page,
            mode,
            "shuffled and answer lengths differ",
          );
          check(
            JSON.stringify(question.shuffled.map((c) => c.id)) !==
              JSON.stringify(question.answerIds),
            page,
            mode,
            "presented already in order",
          );
        }
      }

      /* A perfect attempt must score full marks, and an empty one zero. Any
         disagreement here means the grader and the generator have drifted. */
      const perfect = shown.questions.map((question): Answer | null => {
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

      const full = markDrill(shown.questions, perfect);
      check(
        full.correct === full.total && full.total === questionCount(shown),
        page,
        mode,
        `a perfect attempt scored ${full.correct}/${full.total}`,
      );

      const none = markDrill(shown.questions, []);
      check(none.correct === 0, page, mode, "an empty attempt scored above zero");
      check(none.total === full.total, page, mode, "totals disagree between attempts");
    }

    if (page % 100 === 0) process.stdout.write(`  ${page} pages…\n`);
  }

  console.log(`\n${totalQuestions.toLocaleString()} questions generated`);
  console.log(`${pagesWithDuel} of ${TOTAL_PAGES} pages have a mutashabihat duel`);
  console.log("\npages supporting each mode:");
  for (const [mode, count] of [...modeCounts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${mode.padEnd(14)} ${count}`);
  }

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} failures:`);
    for (const failure of failures.slice(0, 25)) {
      console.error(`  page ${failure.page} · ${failure.mode}: ${failure.why}`);
    }
    if (failures.length > 25) console.error(`  … and ${failures.length - 25} more`);
    process.exit(1);
  }

  console.log("\n✓ every page, every mode, round trip intact");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
