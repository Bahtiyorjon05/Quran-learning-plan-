"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Shuffle, Sparkles } from "lucide-react";

import { MARK_IDLE } from "@/core/plan/mark-state";
import { resolveSpot } from "@/app/[locale]/app/mistakes/actions";
import { displayWords } from "@/core/quran/arabic";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * The words that keep going wrong.
 *
 * Every drill has recorded exactly which word was missed and in which ayah, and
 * this is the first screen that shows any of it back. The point is that it is
 * specific: not "68%" but *this word, in this ayah, four times* — with the word
 * marked in the ayah itself, because reading it in place is how a reciter
 * recognises the gap.
 *
 * Two kinds of mistake are told apart, because they need different work. A
 * blank is something not held; a confusion is two passages that have merged,
 * and the cure for that one is the mutashabihat drill rather than more
 * repetition.
 */

export type Spot = {
  key: string;
  surah: number;
  ayah: number;
  page: number;
  count: number;
  words: number[];
  confusable: boolean;
  text: string;
  surahName: string;
};

export function WeakSpots({ spots }: { spots: Spot[] }) {
  const t = useTranslations("mistakes");

  return (
    <ul className="space-y-3">
      {spots.map((spot) => (
        <SpotRow key={spot.key} spot={spot} t={t} />
      ))}
    </ul>
  );
}

function SpotRow({
  spot,
  t,
}: {
  spot: Spot;
  t: ReturnType<typeof useTranslations<"mistakes">>;
}) {
  const [, submit, pending] = useActionState(resolveSpot, MARK_IDLE);

  const words = displayWords(spot.text);
  const missed = new Set(spot.words);

  return (
    <li
      className={cn(
        "panel rounded-2xl p-4 sm:p-5",
        spot.confusable && "!border-gold-500/40",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.875rem] font-medium text-[var(--text-strong)]">
          {spot.surahName} {spot.surah}:{spot.ayah}
        </span>

        <span className="flex items-center gap-2.5">
          {spot.confusable && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/35 bg-gold-500/10 px-2.5 py-0.5 text-[0.6875rem] text-gold-ink">
              <Shuffle className="h-3 w-3" />
              {t("confused")}
            </span>
          )}
          <span className="text-[0.75rem] text-[var(--text-muted)] tabular-nums">
            {t("timesMissed", { count: spot.count })}
          </span>
        </span>
      </div>

      {/* The ayah, with the missed words marked in place. Reading it whole is
          the point — a list of words out of context teaches nothing. */}
      {spot.text && (
        <p
          dir="rtl"
          lang="ar"
          className="font-quran mt-3 rounded-xl bg-[var(--surface-inset)]/40 px-4 py-3 text-[1.25rem] leading-[2.4] text-[var(--text-strong)] sm:text-[1.375rem]"
        >
          {words.map((word, i) => (
            <span
              key={i}
              className={cn(
                missed.has(i) &&
                  "rounded-md bg-danger/12 px-1.5 text-danger underline decoration-danger/40 decoration-dotted underline-offset-4",
              )}
            >
              {word}{" "}
            </span>
          ))}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          href={
            spot.confusable
              ? `/app/practice/${spot.page}?mode=mutashabihat`
              : `/app/practice/${spot.page}?mode=gap`
          }
          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3.5 text-[0.75rem] font-medium text-[var(--accent-strong)] transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--accent)_16%,transparent)]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {spot.confusable ? t("drillConfusion") : t("drillWord")}
        </Link>

        <Link
          href={`/app/quran/${spot.page}#ayah-${spot.key}`}
          className="inline-flex h-9 items-center rounded-full border border-[var(--line-strong)] px-3.5 text-[0.75rem] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)]"
        >
          {t("open")}
        </Link>

        {/* Resolving hides it; it does not delete the record. What went wrong
            once is history, and the report of hardest passages rests on it. */}
        <form action={submit} className="ms-auto">
          <input type="hidden" name="surah" value={spot.surah} />
          <input type="hidden" name="ayah" value={spot.ayah} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-[0.75rem] text-[var(--text-faint)] transition-colors duration-300 hover:text-[var(--accent-strong)] disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {t("gotIt")}
          </button>
        </form>
      </div>
    </li>
  );
}
