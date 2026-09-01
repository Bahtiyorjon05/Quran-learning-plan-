"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Pause, Play, Repeat, SkipForward, Volume2 } from "lucide-react";

import {
  RECITERS,
  ayahAudioUrl,
  reciter as reciterById,
  surahAudioUrl,
} from "@/lib/reciters";
import { useLocalValue, writeLocal } from "@/lib/client-store";
import { cn } from "@/lib/utils";

/**
 * Listening to the page.
 *
 * Built for memorising rather than for listening. Three things follow from
 * that, and none of them is what a plain audio player does:
 *
 *   - The verse being recited is marked in the text, and the page scrolls to
 *     keep it in view. Following a recitation while hunting for your place is
 *     the thing that makes people give up on listening while they learn.
 *   - Repeat loops one verse rather than the page. The same verse, ten times,
 *     is how a page is actually committed to memory.
 *   - A reciter who cannot do either says so, rather than quietly behaving
 *     differently. Badr al-Turki is one file per surah with no timing data, so
 *     nothing can know which verse is sounding.
 *
 * One <audio> element for the whole page, re-pointed at each verse in turn.
 * Six hundred audio elements is how a browser tab starts using a gigabyte.
 *
 * The mark is an attribute written onto the DOM node, not React state: the page
 * is server-rendered and the Arabic must not re-render once a verse.
 */

const RECITER_KEY = "ahd-reciter";
const REPEAT_KEY = "ahd-repeat-ayah";
const FOLLOW_KEY = "ahd-follow-recitation";
const SPEED_KEY = "ahd-recitation-speed";

/** Slow enough to follow a hard ayah, and never so fast it stops being tajwid. */
const SPEEDS = [0.5, 0.75, 1, 1.25] as const;
type Speed = (typeof SPEEDS)[number];

export type PlayableAyah = { k: string; s: number; a: number };

export function Recitation({ ayahs }: { ayahs: PlayableAyah[] }) {
  const t = useTranslations("quran.audio");
  const locale = useLocale() as "uz" | "en" | "ru";

  const reciter = reciterById(useLocalValue(RECITER_KEY) ?? "");
  const repeatOne = useLocalValue(REPEAT_KEY) === "true";

  /* Half speed is the reason this control exists: a difficult ayah taken slowly
     is the oldest trick in hifz, and every reciter here is too fast for a
     beginner at least once. */
  const storedSpeed = Number(useLocalValue(SPEED_KEY));
  const speed = SPEEDS.includes(storedSpeed as Speed) ? (storedSpeed as Speed) : 1;
  /* On by default: someone who pressed play wants to read along, and having to
     find the control before that works would be a strange first impression. */
  const follow = useLocalValue(FOLLOW_KEY) !== "false";

  const perAyah = reciter.kind === "ayah";

  const [index, setIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  /* Kept in state rather than read off the element: reading `audio.paused`
     during render is the ref access React forbids, and it would not re-render
     when the audio pauses anyway. */
  const [paused, setPaused] = useState(true);

  /* Position, for the seek bar. Kept in state because it has to be drawn, and
     updated from the element's own timeupdate rather than a timer — the
     element is the thing that knows. */
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* playbackRate is a property of the element, not of the file, so it has to
     be set again after every new src. */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  });

  /* The mark, and the scroll that follows it. */
  useEffect(() => {
    const current = index === null ? null : ayahs[index];

    for (const node of document.querySelectorAll("[data-ayah]")) {
      node.toggleAttribute("data-reciting", node.getAttribute("data-ayah") === current?.k);
    }

    if (!follow || !current) return;

    const node = document.querySelector(`[data-ayah="${current.k}"]`);
    if (!(node instanceof HTMLElement)) return;

    /* Only scroll when the verse is not already comfortably on screen. A
       scroll on every verse fights the reader who has scrolled ahead
       deliberately, and on a phone it is nauseating. */
    const box = node.getBoundingClientRect();
    const comfortable = box.top >= 96 && box.bottom <= window.innerHeight - 96;
    if (comfortable) return;

    node.scrollIntoView({
      /* "center" on a phone, where the viewport is short and a verse near the
         bottom would otherwise sit under the tab bar. */
      block: window.innerWidth < 640 ? "center" : "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [index, ayahs, follow]);

  /* Nothing left marked when the page turns. */
  useEffect(
    () => () => {
      for (const node of document.querySelectorAll("[data-reciting]")) {
        node.removeAttribute("data-reciting");
      }
    },
    [],
  );

  function sourceFor(id: string, at: number): string {
    const r = reciterById(id);
    return r.kind === "ayah"
      ? ayahAudioUrl(id, ayahs[at].s, ayahs[at].a)
      : surahAudioUrl(id, ayahs[at].s);
  }

  function playAt(next: number) {
    if (next < 0 || next >= ayahs.length) {
      setIndex(null);
      return;
    }
    setIndex(next);
    setFailed(false);
    setLoading(true);
    setPosition(0);
    setDuration(0);

    const audio = audioRef.current;
    if (!audio) return;
    audio.src = sourceFor(reciter.id, next);
    void audio.play().catch(() => {
      setLoading(false);
      setFailed(true);
    });
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (index === null) return playAt(0);
    if (paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  /* Changing reciter mid-page restarts where you are in the new voice rather
     than jumping to the top — which is what you want when you switched
     because you could not follow the last one. */
  function chooseReciter(id: string) {
    writeLocal(RECITER_KEY, id);
    const audio = audioRef.current;
    if (index === null || !audio) return;
    const wasPlaying = !paused;
    audio.src = sourceFor(id, index);
    if (wasPlaying) void audio.play().catch(() => setFailed(true));
  }

  const started = index !== null;

  return (
    <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)]/40 p-4 sm:p-5">
      <audio
        ref={audioRef}
        preload="none"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
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
          /* A surah file has already played the whole chapter, so there is
             nothing after it. A verse file moves on, or repeats. */
          if (!perAyah) return setIndex(null);
          playAt(repeatOne ? index : index + 1);
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={started && !paused ? t("pause") : t("play")}
          className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-ground)] text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
        >
          {loading ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : started && !paused ? (
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
            {!started
              ? t("idle")
              : failed
                ? t("failed")
                : perAyah
                  ? t("nowPlaying", { ayah: `${ayahs[index].s}:${ayahs[index].a}` })
                  : t("nowPlayingSurah")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* Both controls only mean anything for a reciter that has one file
              per verse, so they are not shown for one that does not. */}
          {perAyah && (
            <>
              <button
                type="button"
                onClick={() => writeLocal(FOLLOW_KEY, String(!follow))}
                aria-pressed={follow}
                title={t("follow")}
                className={cn(
                  "inline-grid h-9 w-9 place-items-center rounded-full border text-[0.6875rem] font-semibold transition-colors duration-300",
                  follow
                    ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
                    : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
                )}
              >
                ↧
              </button>

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
            </>
          )}
        </div>
      </div>

      {/* ── Position ──
          Shown only once something is playing: an empty scrubber above a
          player that has never been started is furniture. */}
      {started && duration > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <span className="w-9 shrink-0 text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
            {clock(position)}
          </span>

          <input
            type="range"
            min={0}
            max={Math.max(0.1, duration)}
            step={0.1}
            value={Math.min(position, duration)}
            onChange={(event) => {
              const audio = audioRef.current;
              if (!audio) return;
              const next = Number(event.target.value);
              audio.currentTime = next;
              setPosition(next);
            }}
            aria-label={t("seek")}
            className="ahd-seek h-1.5 flex-1"
            style={{ ["--played" as string]: `${(position / duration) * 100}%` }}
          />

          <span className="w-9 shrink-0 text-end text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
            {clock(duration)}
          </span>
        </div>
      )}

      {/* ── Speed ── */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-[0.6875rem] tracking-[0.1em] text-[var(--text-faint)] uppercase">
          {t("speed")}
        </span>
        {SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => writeLocal(SPEED_KEY, String(option))}
            aria-pressed={option === speed}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.6875rem] tabular-nums",
              "transition-[border-color,background-color,color] duration-300",
              option === speed
                ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
                : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
            )}
          >
            {option}&times;
          </button>
        ))}
      </div>

      {/* The reciters, named in the reader's own language. Buttons rather than
          a dropdown, for the same reason the language switcher is buttons: one
          tap, and you can see what you are switching from. */}
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
            {option.kind === "surah" && (
              <span className="ms-1.5 text-[0.625rem] text-[var(--text-faint)]">
                {t("wholeSurah")}
              </span>
            )}
          </button>
        ))}
      </div>

      {!perAyah && (
        <p className="mt-3 text-[0.75rem] leading-relaxed text-[var(--text-faint)]">
          {t("wholeSurahNote")}
        </p>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-[0.75rem] text-danger">
          {t("failedHelp")}
        </p>
      )}
    </div>
  );
}

/** "1:07". Seconds only; no recitation of one ayah runs to an hour. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
