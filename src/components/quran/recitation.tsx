"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Pause, Play, Repeat, SkipForward, Volume2 } from "lucide-react";

import { RECITERS, ayahAudioUrl, reciter as reciterById } from "@/lib/reciters";
import { useLocalValue, writeLocal } from "@/lib/client-store";
import { cn } from "@/lib/utils";

/**
 * Listening to the page.
 *
 * Built for memorising rather than for listening: the ayah being recited is
 * marked in the text as it plays, and the repeat control loops a single ayah,
 * which is how a page is actually learned — the same verse, ten times, until it
 * stays.
 *
 * One <audio> element for the whole page, re-pointed at each ayah in turn,
 * rather than one per ayah. Six hundred audio elements on a page is how a
 * browser tab starts using a gigabyte.
 *
 * The playing ayah is marked by writing an attribute on the DOM node rather
 * than by lifting it into React state: the page is server-rendered and the
 * Arabic must not re-render forty times a minute.
 */

const RECITER_KEY = "ahd-reciter";
const REPEAT_KEY = "ahd-repeat-ayah";

export type PlayableAyah = { k: string; s: number; a: number };

export function Recitation({ ayahs }: { ayahs: PlayableAyah[] }) {
  const t = useTranslations("quran.audio");
  const locale = useLocale() as "uz" | "en" | "ru";

  const storedReciter = useLocalValue(RECITER_KEY);
  const reciter = reciterById(storedReciter ?? "");

  const repeatOne = useLocalValue(REPEAT_KEY) === "true";

  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /* Whether it is actually playing, kept in state rather than read off the
     element: reading `audioRef.current.paused` while rendering is exactly the
     kind of ref access React forbids, and it would not re-render on its own
     when the audio pauses anyway. */
  const [paused, setPaused] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* The mark travels with playback. Cleared on unmount so a page turn never
     leaves a highlight behind. */
  useEffect(() => {
    const current = index === null ? null : ayahs[index];
    for (const node of document.querySelectorAll("[data-ayah]")) {
      node.toggleAttribute("data-reciting", node.getAttribute("data-ayah") === current?.k);
    }
    return () => {
      for (const node of document.querySelectorAll("[data-reciting]")) {
        node.removeAttribute("data-reciting");
      }
    };
  }, [index, ayahs]);

  function playAt(next: number) {
    if (next < 0 || next >= ayahs.length) {
      setIndex(null);
      return;
    }
    setIndex(next);
    setFailed(false);
    setLoading(true);

    const audio = audioRef.current;
    if (!audio) return;
    audio.src = ayahAudioUrl(reciter.id, ayahs[next].s, ayahs[next].a);
    void audio.play().catch(() => {
      setLoading(false);
      setFailed(true);
    });
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (index === null) {
      playAt(0);
      return;
    }
    if (paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  /* Changing reciter mid-page restarts the current ayah in the new voice
     rather than jumping to the top, which is what you want when you switched
     because you could not follow the last one. */
  function chooseReciter(id: string) {
    writeLocal(RECITER_KEY, id);
    const audio = audioRef.current;
    if (index === null || !audio) return;
    const wasPlaying = !paused;
    audio.src = ayahAudioUrl(id, ayahs[index].s, ayahs[index].a);
    if (wasPlaying) void audio.play().catch(() => setFailed(true));
  }

  const playing = index !== null && !failed;

  return (
    <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)]/40 p-4 sm:p-5">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onPlaying={() => setLoading(false)}
        onWaiting={() => setLoading(true)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
        onEnded={() => {
          if (index === null) return;
          /* Repeat holds this ayah; otherwise the page plays on to the next,
             which is what makes it usable while following along. */
          playAt(repeatOne ? index : index + 1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? t("pause") : t("play")}
          className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-ground)] text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
        >
          {loading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : playing && !paused ? (
            <Pause className="h-4.5 w-4.5" />
          ) : (
            <Play className="h-4.5 w-4.5 translate-x-px" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--text-strong)]">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
            {reciter.name[locale]}
          </p>
          <p className="mt-0.5 truncate text-[0.75rem] text-[var(--text-muted)]">
            {index === null
              ? t("idle")
              : failed
                ? t("failed")
                : t("nowPlaying", { ayah: `${ayahs[index].s}:${ayahs[index].a}` })}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => writeLocal(REPEAT_KEY, String(!repeatOne))}
            aria-pressed={repeatOne}
            title={t("repeat")}
            className={cn(
              "inline-grid h-9 w-9 place-items-center rounded-full border transition-colors duration-300",
              repeatOne
                ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
            )}
          >
            <Repeat className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => index !== null && playAt(index + 1)}
            disabled={index === null || index >= ayahs.length - 1}
            aria-label={t("next")}
            className="inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)] disabled:opacity-35"
          >
            <SkipForward className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* The reciters, named in the reader's own language. Three buttons rather
          than a dropdown, for the same reason the language switcher is three
          buttons: it is one tap and you can see what you are switching from. */}
      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--line-subtle)] pt-4">
        {RECITERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => chooseReciter(option.id)}
            aria-pressed={option.id === reciter.id}
            title={option.note[locale]}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[0.75rem] transition-[border-color,background-color,color] duration-300",
              option.id === reciter.id
                ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
                : "border-[var(--line-strong)] text-[var(--text-muted)] hover:border-[var(--text-faint)] hover:text-[var(--text-strong)]",
            )}
          >
            {option.name[locale]}
          </button>
        ))}
      </div>

      {failed && (
        <p role="alert" className="mt-3 text-[0.75rem] text-danger">
          {t("failedHelp")}
        </p>
      )}
    </div>
  );
}
