"use client";

import { useActionState, useOptimistic, startTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  Flame,
  Layers,
  Loader2,
  RefreshCw,
  Sprout,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { MARK_IDLE } from "@/core/plan/mark-state";
import { markTrack } from "@/app/[locale]/app/day-actions";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TrackView = {
  id: "sabaq" | "sabqi" | "manzil";
  arabic: string;
  detail: string | null;
  pages: number[];
  done: boolean;
  /** Nothing is owed on this track today. */
  empty: boolean;
};

const ICONS = { sabaq: Sprout, sabqi: RefreshCw, manzil: Layers } as const;

/**
 * The three obligations, and a tick for each.
 *
 * This is the screen the whole product exists to produce. It is deliberately
 * plain: what to recite, where it is, and whether it is done. A day is complete
 * only when every track that asked for something has been met.
 */
export function DailySheet({
  tracks,
  streak,
  complete,
}: {
  tracks: TrackView[];
  streak: number;
  complete: boolean;
}) {
  const t = useTranslations("app.today");
  const tt = useTranslations("landing.tracks");

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-normal text-[var(--text-strong)]">
          {t("heading")}
        </h2>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-gold-500/10 px-2.5 py-1 text-[0.6875rem] font-medium text-gold-ink">
            <Flame className="h-3 w-3" />
            {t("streak", { count: streak })}
          </span>
        )}
      </div>

      {complete && (
        <p className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] px-4 py-3 text-[0.9375rem] text-[var(--accent-strong)]">
          <strong className="font-medium">{t("allDone")}</strong>{" "}
          <span className="text-[var(--text-muted)]">{t("allDoneBody")}</span>
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            name={tt(`${track.id}.name`)}
            role={tt(
              track.id === "sabaq" ? "roleNew" : track.id === "sabqi" ? "roleRecent" : "roleOld",
            )}
          />
        ))}
      </ul>
    </section>
  );
}

function TrackRow({
  track,
  name,
  role,
}: {
  track: TrackView;
  name: string;
  role: string;
}) {
  const t = useTranslations("app.today");
  const [, submit, pending] = useActionState(markTrack, MARK_IDLE);
  const [done, setDone] = useOptimistic(track.done);

  const Icon = ICONS[track.id];
  /* The first page of the track is where "open" should land: for sabaq that is
     where today's new portion begins, for revision the first page due. */
  const firstPage = track.pages[0];

  return (
    <li
      className={cn(
        "rounded-2xl border p-4 transition-[border-color,background-color] duration-300 ease-[var(--ease-calm)] sm:p-5",
        track.empty
          ? "border-dashed border-[var(--line-strong)] opacity-60"
          : done
            ? "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_7%,transparent)]"
            : "border-[var(--line-strong)]",
      )}
    >
      <div className="flex items-start gap-3.5">
        <span
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
            done
              ? "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]"
              : "border-[var(--line-subtle)] bg-[var(--surface-overlay)]",
          )}
        >
          {done ? (
            <Check className="h-4.5 w-4.5 text-[var(--accent)]" strokeWidth={2.5} />
          ) : (
            <Icon
              className={cn(
                "h-4.5 w-4.5",
                track.empty ? "text-[var(--text-faint)]" : "text-[var(--accent)]",
              )}
              strokeWidth={1.6}
            />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-arabic text-[0.9375rem] leading-none text-gold-ink/90" aria-hidden dir="rtl">
              {track.arabic}
            </span>
            <span className="text-[0.9375rem] font-medium text-[var(--text-strong)]">{name}</span>
            <span className="ms-auto shrink-0 text-[0.625rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
              {role}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-[var(--text-muted)]">
            {track.detail ??
              (track.id === "sabaq" ? t("nothingNew") : t("nothingToRevise"))}
          </p>

          {!track.empty && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <form
                action={(formData) => {
                  startTransition(() => setDone(!done));
                  submit(formData);
                }}
              >
                <input type="hidden" name="track" value={track.id} />
                <input type="hidden" name="done" value={String(!done)} />
                <button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium",
                    "transition-[background-color,border-color,color] duration-300 ease-[var(--ease-calm)]",
                    done
                      ? "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                      : "border-[var(--accent)] bg-[var(--accent-ground)] text-[var(--on-accent)]",
                    pending && "opacity-70",
                  )}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {done ? t("undo") : t("markDone")}
                </button>
              </form>

              {firstPage && (
                <Link
                  href={`/app/quran/${firstPage}`}
                  className={buttonStyles({
                    variant: "outline",
                    size: "sm",
                    className: "group",
                  })}
                >
                  {t("openPage")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
