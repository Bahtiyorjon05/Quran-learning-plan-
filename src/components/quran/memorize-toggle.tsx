"use client";

import { useActionState, useOptimistic, startTransition } from "react";
import { useTranslations } from "next-intl";
import { BookmarkCheck, Bookmark, Loader2 } from "lucide-react";

import { MARK_IDLE } from "@/core/plan/mark-state";
import { setPageMemorized } from "@/app/[locale]/app/quran/actions";
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
}: {
  page: number;
  memorized: boolean;
}) {
  const t = useTranslations("app.mushaf");
  const [, submit, pending] = useActionState(setPageMemorized, MARK_IDLE);
  const [shown, setShown] = useOptimistic(memorized);

  return (
    <form
      action={(formData) => {
        startTransition(() => setShown(!shown));
        submit(formData);
      }}
    >
      <input type="hidden" name="page" value={page} />
      <input type="hidden" name="memorized" value={String(!shown)} />

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
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : shown ? (
          <BookmarkCheck className="h-3.5 w-3.5" />
        ) : (
          <Bookmark className="h-3.5 w-3.5" />
        )}
        {shown ? t("memorized") : t("markMemorized")}
      </button>
    </form>
  );
}
