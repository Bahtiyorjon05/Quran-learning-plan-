"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { BookmarkCheck, Bookmark, Loader2 } from "lucide-react";

import { MARK_IDLE } from "@/core/plan/mark-state";
import { setPageMemorized } from "@/app/[locale]/app/quran/actions";
import { pageLearnt } from "@/lib/cheer-store";
import { cn } from "@/lib/utils";

/**
 * Marking a page memorized, for a signed-in reader.
 *
 * Optimistic: the button flips the moment it is pressed rather than after a
 * round trip to Frankfurt. Someone marking their way through a juz should not
 * wait on the network between pages, and if the write fails the state falls
 * back on its own when the action resolves.
 */
export function MemorizeToggle({
  page,
  memorized,
  surah,
  label,
}: {
  page: number;
  memorized: boolean;
  /** One surah of a shared page, rather than the page as a whole. */
  surah?: number;
  label?: string;
}) {
  const t = useTranslations("app.mushaf");
  const tm = useTranslations("app.milestone");
  /* The action is awaited, and the form's `action` returns that promise.
   *
   * Dispatching through `useActionState` from inside an inline action returns
   * nothing to await, so React had no promise to hold the transition open on
   * and the browser fell through to a native form POST — a full page load,
   * which threw away the whole JavaScript context and with it the
   * congratulation that had just been announced. Returning the promise keeps
   * the submission where it belongs. */
  const [busy, start] = useTransition();
  const [shown, setShown] = useOptimistic(memorized);
  const [failed, setFailed] = useState(false);
  const pending = busy;

  return (
    <form
      action={(formData) =>
        new Promise<void>((resolve) => {
          start(async () => {
            const turningOn = !shown;
            setShown(turningOn);
            /* Announced rather than held here: this button sits inside the tree
               the action re-renders, so anything it remembers is gone before it
               can be drawn. The store lives outside the tree and survives. */
            if (turningOn) {
              pageLearnt({
                mashaallah: tm("mashaallah"),
                line: tm("pageLearnt", { page }),
              });
            }

            const result = await setPageMemorized(MARK_IDLE, formData);
            setFailed(result.status === "error");
            resolve();
          });
        })
      }
    >
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="memorized" value={String(!shown)} />
      {surah !== undefined && <input type="hidden" name="surah" value={surah} />}

      <button
        type="submit"
        disabled={pending}
        aria-pressed={shown}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium",
          "transition-[background-color,border-color,color] duration-300 ease-[var(--ease-calm)]",
          shown
            ? "border-[var(--accent)] bg-[var(--accent-ground)] text-[var(--on-accent)]"
            : "border-[var(--line-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text-strong)]",
          pending && "opacity-70",
          failed && "!border-danger/60",
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : shown ? (
          <BookmarkCheck className="h-3.5 w-3.5" />
        ) : (
          <Bookmark className="h-3.5 w-3.5" />
        )}
        {label ?? (shown ? t("memorized") : t("markMemorized"))}
      </button>
    </form>
  );
}
