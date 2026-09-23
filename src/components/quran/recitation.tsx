"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Loader2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Square,
  Volume2,
} from "lucide-react";

import {
  RECITERS,
  ayahAudioUrl,
  basmalaAudioUrl,
  opensWithBasmala,
  reciter as reciterById,
  surahAudioUrl,
} from "@/lib/reciters";
import { useLocalValue, writeLocal } from "@/lib/client-store";
import { useRouter } from "@/i18n/navigation";
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
 *   - Repeat works on one verse rather than the page. The same verse, ten
 *     times, is how a page is actually committed to memory.
 *   - The end of the page is a choice — stop, go round again, or turn over —
 *     because finishing the page you are learning and being carried on into
 *     one you have not started is the opposite of what memorising wants.
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

/**
 * One <audio>, owned by this module rather than by React.
 *
 * Switching language is a route change, and a route change unmounts every
 * component under it — which killed the recitation stone dead halfway through
 * an ayah. Nothing about changing the language of the interface should stop
 * the Qur'an being recited, so the element lives on `document.body`, outside
 * anything React reconciles, and survives the switch untouched.
 *
 * Created lazily and never removed: it is one element for the life of the tab,
 * which is also why six hundred of them are not created for six hundred
 * verses.
 */
let shared: HTMLAudioElement | null = null;

function sharedAudio(): HTMLAudioElement {
  if (shared) return shared;
  shared = document.createElement("audio");
  shared.preload = "none";
  /* Findable from a test, and obvious in an inspector. */
  shared.setAttribute("data-ahd-recitation", "");
  document.body.append(shared);
  return shared;
}

/**
 * The next verse, fetched while this one is still sounding.
 *
 * One element with `preload="none"` means every ayah is asked for at the exact
 * moment it is needed, so on anything but a fast connection there is a silence
 * between verses while the file arrives — which is precisely when following
 * along falls apart. Two verses are kept warm ahead of the one playing.
 *
 * Done with a second <audio> rather than fetch() on purpose: the media loader
 * needs no CORS headers, goes through the service worker like the real request
 * will, and fills the same cache — so when the player asks, the file is
 * already there. It never plays; it only loads.
 */
let warmer: HTMLAudioElement | null = null;

function warm(urls: string[]) {
  if (typeof document === "undefined" || urls.length === 0) return;

  if (!warmer) {
    warmer = document.createElement("audio");
    warmer.preload = "auto";
    warmer.muted = true;
    warmer.setAttribute("data-ahd-warmer", "");
    document.body.append(warmer);
  }

  /* One at a time, and the nearest first: a phone on one bar gains nothing
     from three parallel downloads competing with the verse being heard. */
  let at = 0;
  const next = () => {
    if (!warmer || at >= urls.length) return;
    warmer.src = urls[at++];
    warmer.load();
  };

  warmer.oncanplaythrough = next;
  warmer.onerror = next;
  next();
}

/** Identity of the page being recited, so a remount knows what it is hearing. */
function pageKeyOf(ayahs: PlayableAyah[]): string {
  return ayahs.length === 0 ? "" : `${ayahs[0].k}:${ayahs.length}`;
}

/**
 * How long the audio may outlive its player before it is stopped.
 *
 * The player unmounts for two very different reasons and the element cannot
 * tell them apart: a language switch, which remounts it a moment later on the
 * same page, and a navigation away, after which nothing can control it. So it
 * keeps playing briefly, and a remount on the same page cancels the stop.
 */
const ORPHAN_GRACE_MS = 1500;
let orphanTimer: ReturnType<typeof setTimeout> | null = null;

const RECITER_KEY = "ahd-reciter";
/* The old on/off repeat, which meant "this ayah, forever". Still honoured for
   anyone who switched it on before it became a count. */
const LEGACY_REPEAT_KEY = "ahd-repeat-ayah";
const REPEAT_KEY = "ahd-repeat-times";
const FOLLOW_KEY = "ahd-follow-recitation";
const SPEED_KEY = "ahd-recitation-speed";
const END_KEY = "ahd-recitation-end";

/** Slow enough to follow a hard ayah, and never so fast it stops being tajwid. */
const SPEEDS = [0.5, 0.75, 1, 1.25] as const;
type Speed = (typeof SPEEDS)[number];

/**
 * How many times each ayah is heard before the next one.
 *
 * A count rather than an on/off switch: "each verse three times, then the
 * next" is how a page is actually taken in, and a loop that never moves on
 * means reaching for the screen after every verse. Infinity is the old
 * behaviour — this one verse until you say otherwise.
 */
const REPEATS = [1, 3, 5, 10, Infinity] as const;

function readRepeat(stored: string | null, legacy: string | null): number {
  if (stored === "inf") return Infinity;
  const times = Number(stored);
  if (stored !== null && (REPEATS as readonly number[]).includes(times))
    return times;
  return legacy === "true" ? Infinity : 1;
}

function repeatLabel(times: number): string {
  return times === Infinity ? "∞" : `${times}×`;
}

/**
 * What happens once the last ayah has been heard.
 *
 * Turning the page by itself used to be the only behaviour, and for someone
 * memorising one page it is exactly wrong: they finish the page they are
 * learning and are carried on into one they have not started. So it is a
 * choice, and stopping is the default.
 */
type EndMode = "stop" | "repeat" | "next";

export type PlayableAyah = { k: string; s: number; a: number };

export function Recitation({
  ayahs,
  nextHref,
  extra,
}: {
  ayahs: PlayableAyah[];
  /**
   * Where the text carries on, if it does.
   *
   * A page of the mushaf is a unit of print, not of recitation — nobody stops
   * mid-surah because the paper ran out. Given this, "turn the page" is
   * offered as what happens at the end, and the last ayah of a page can carry
   * on into the next one.
   */
  nextHref?: string;
  /**
   * Rendered inside the options panel.
   *
   * The offline download used to be a second card stacked under this one, and
   * between them they filled a laptop screen before a single ayah appeared.
   * It is asked for perhaps once per surah; it does not belong above the words
   * every time the page is opened.
   */
  extra?: React.ReactNode;
}) {
  const t = useTranslations("quran.audio");
  const locale = useLocale() as "uz" | "en" | "ru";
  const router = useRouter();

  const reciter = reciterById(useLocalValue(RECITER_KEY) ?? "");
  const repeatTimes = readRepeat(
    useLocalValue(REPEAT_KEY),
    useLocalValue(LEGACY_REPEAT_KEY),
  );

  /* "Turn the page" is only a choice where there is a page to turn to. A
     surah or a juz read whole has nowhere further to go, so a stored "next"
     means stop there. */
  const storedEnd = useLocalValue(END_KEY);
  const atEnd: EndMode =
    storedEnd === "repeat"
      ? "repeat"
      : storedEnd === "next" && nextHref
        ? "next"
        : "stop";

  /* Half speed is the reason this control exists: a difficult ayah taken slowly
     is the oldest trick in hifz, and every reciter here is too fast for a
     beginner at least once. */
  const storedSpeed = Number(useLocalValue(SPEED_KEY));
  const speed = SPEEDS.includes(storedSpeed as Speed)
    ? (storedSpeed as Speed)
    : 1;
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
  /* Whether what is sounding is the Basmala rather than the ayah it opens.
     Kept in state because the mark has to move to a different element, and set
     only from event handlers — never from inside an effect. */
  const [sayingBasmala, setSayingBasmala] = useState(false);
  /* Which hearing of the current ayah this is, from zero, when each is heard
     more than once. */
  const [pass, setPass] = useState(0);

  /* Position, for the seek bar. Kept in state because it has to be drawn, and
     updated from the element's own timeupdate rather than a timer — the
     element is the thing that knows. */
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pageKey = pageKeyOf(ayahs);

  /* Adopt the shared element: attach the handlers that used to be JSX props,
     and — when this is a remount after a language switch — pick the recitation
     up exactly where it still is rather than showing a stopped player over
     audio that is audibly still going. */
  useEffect(() => {
    const audio = sharedAudio();
    audioRef.current = audio;

    if (orphanTimer) {
      clearTimeout(orphanTimer);
      orphanTimer = null;
    }

    const adopting = audio.dataset.pageKey === pageKey && Boolean(audio.src);
    const turningOver = audio.dataset.autostart === "1";

    if (!adopting && !turningOver && audio.src) {
      /* A different page. Whatever was playing belongs to somewhere else. */
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      delete audio.dataset.index;
      delete audio.dataset.basmala;
    }
    audio.dataset.pageKey = pageKey;

    const onAdopt = () => {
      const at = Number(audio.dataset.index);
      if (Number.isInteger(at) && at >= 0 && at < ayahs.length) setIndex(at);
      setSayingBasmala(audio.dataset.basmala === "1");
    };

    /* Arriving on a page the recitation turned to by itself. Routed through an
       event for the same reason as adopting: it puts the start on the same
       path as any other, rather than setting state from inside an effect. */
    const onAutostart = () => {
      delete audio.dataset.autostart;
      if (ayahs.length > 0) playAt(0);
    };
    const onMeta = () => setDuration(audio.duration || 0);
    const onTime = () => setPosition(audio.currentTime);
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    const onPlaying = () => setLoading(false);
    const onWaiting = () => setLoading(true);
    const onError = () => {
      /* Emptying the element to stop it is not a failure. */
      if (!audio.getAttribute("src")) return;
      setLoading(false);
      setFailed(true);
    };

    audio.addEventListener("ahd-adopt", onAdopt);
    audio.addEventListener("ahd-autostart", onAutostart);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("error", onError);

    /* Catching up after a language switch, without setting state from inside
       an effect. The element already knows whether it is playing, where it has
       reached and which ayah is sounding; asking it to say so again routes
       that through the same handlers any real playback would use, so there is
       one path into this component's state rather than two. */
    if (turningOver) {
      audio.dispatchEvent(new Event("ahd-autostart"));
    } else if (adopting) {
      audio.dispatchEvent(new Event("ahd-adopt"));
      audio.dispatchEvent(new Event(audio.paused ? "pause" : "play"));
      if (Number.isFinite(audio.duration))
        audio.dispatchEvent(new Event("loadedmetadata"));
      audio.dispatchEvent(new Event("timeupdate"));
    }

    return () => {
      audio.removeEventListener("ahd-adopt", onAdopt);
      audio.removeEventListener("ahd-autostart", onAutostart);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("error", onError);

      /* Not stopped here: this unmount may be a language switch, and the mount
         that follows cancels the timer. If nothing remounts, the recitation
         has genuinely been left behind and is stopped. */
      if (orphanTimer) clearTimeout(orphanTimer);
      orphanTimer = setTimeout(() => {
        orphanTimer = null;
        audio.pause();
      }, ORPHAN_GRACE_MS);
    };
    /* `playAt` is deliberately not a dependency. It is rebuilt on every render,
       so listing it would tear down and re-attach every listener on this shared
       element several times a second — and the only thing that reads it here is
       the autostart, which fires once, on mount, from this render's closure.
       The values it captures are this page's, which is exactly what is wanted. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, ayahs.length]);

  /* `ended` carries state that changes between renders, so it is bound
     separately from the handlers above rather than re-attaching all of them. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      if (index === null) return;

      /* The Basmala has just finished; the ayah it opens comes next, at the
         same index rather than the one after it. */
      if (audio.dataset.basmala === "1") {
        delete audio.dataset.basmala;
        setSayingBasmala(false);
        setLoading(true);
        audio.src = sourceFor(reciter.id, index);
        if (index + 1 < ayahs.length) warm([sourceFor(reciter.id, index + 1)]);
        start(audio);
        return;
      }

      /* A surah file has already played the whole chapter, so there is nothing
         after it but the chapter again, if that was asked for. */
      if (!perAyah) {
        if (atEnd === "repeat") return playAt(index);
        return stop();
      }

      /* This ayah again, until it has been heard as many times as asked. */
      const heard = pass + 1;
      if (heard < repeatTimes)
        return playAt(index, { basmala: false, pass: heard });

      if (index + 1 < ayahs.length) return playAt(index + 1);

      /* The end of the page. */
      if (atEnd === "repeat") return playAt(0);

      /* Turn over and keep reciting. The flag rides on the element because
         the component that reads it is not this one — it is the next page's. */
      if (atEnd === "next" && nextHref) {
        audio.dataset.autostart = "1";
        router.push(nextHref);
        return;
      }

      stop();
    };

    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  });

  /* "Recite from here", asked for by a button beside a verse. Listened for on
     the document rather than passed down as a callback, so the six hundred
     verses of a page stay server-rendered and inert. */
  useEffect(() => {
    const onRequest = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      const at = ayahs.findIndex((ayah) => ayah.k === key);
      if (at < 0) return;

      /* The same verse again means pause it, and again after that resumes.
         Tapping the verse you are already listening to and having it start
         from the beginning is the one thing the button could do that nobody
         wants. */
      if (at === index) return paused ? resume() : pause();

      playAt(at);
    };

    document.addEventListener("ahd-play-ayah", onRequest);
    return () => document.removeEventListener("ahd-play-ayah", onRequest);
  });

  /* playbackRate is reset to defaultPlaybackRate by every new src, so both are
     set: the default carries the speed across the change of verse, rather than
     the first moments of each one playing at normal speed. */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
  });

  /* The mark: which verse is lit, and whether its own button shows play or
     pause. Written onto the DOM so the server-rendered Arabic never re-renders.

     The two are separate attributes on purpose. `data-reciting` is the light,
     and while the Basmala sounds it belongs on the Basmala. `data-ayah-state`
     is the button, and it stays on the verse being worked through — paused or
     not, Basmala or not — so that verse's button always does the right thing
     and says so. */
  useEffect(() => {
    const current = index === null ? null : ayahs[index];
    const onBasmala = sayingBasmala && current !== null;
    const playLabel = t("play");
    const pauseLabel = t("pause");

    for (const node of document.querySelectorAll("[data-ayah]")) {
      const mine =
        current !== null && node.getAttribute("data-ayah") === current.k;
      node.toggleAttribute("data-reciting", mine && !onBasmala);

      if (mine)
        node.setAttribute("data-ayah-state", paused ? "paused" : "playing");
      else node.removeAttribute("data-ayah-state");

      /* The label has to follow the icon, or a screen reader announces "play"
         on the button that is about to stop the recitation. */
      const button = node.querySelector("[data-ayah-play]");
      const label = mine && !paused ? pauseLabel : playLabel;
      if (button && button.getAttribute("aria-label") !== label) {
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
      }
    }

    for (const node of document.querySelectorAll("[data-basmala]")) {
      node.toggleAttribute(
        "data-reciting",
        onBasmala && node.getAttribute("data-basmala") === String(current?.s),
      );
    }
  }, [index, ayahs, sayingBasmala, paused, t]);

  /* The scroll that follows the mark. Kept apart from it so that pausing —
     which changes the mark — never drags the page back to a verse the reader
     has deliberately scrolled away from. */
  useEffect(() => {
    const current = index === null ? null : ayahs[index];
    if (!follow || !current) return;

    const node = sayingBasmala
      ? document.querySelector(`[data-basmala="${current.s}"]`)
      : document.querySelector(`[data-ayah="${current.k}"]`);
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
  }, [index, ayahs, follow, sayingBasmala]);

  /* Nothing left marked when the page turns. Deferred for the same reason the
     audio is: an unmount may be a language switch, and clearing the mark there
     would blank the verse being recited for as long as the switch takes. */
  useEffect(
    () => () => {
      setTimeout(() => {
        const audio = document.querySelector("[data-ahd-recitation]");
        if (audio instanceof HTMLAudioElement && !audio.paused) return;
        for (const node of document.querySelectorAll("[data-reciting]")) {
          node.removeAttribute("data-reciting");
        }
        for (const node of document.querySelectorAll("[data-ayah-state]")) {
          node.removeAttribute("data-ayah-state");
        }
      }, 0);
    },
    [],
  );

  /* The phone's own controls — the lock screen, headphones, a car — reach the
     same functions the buttons do. Registered once; they read the latest
     versions through a ref, so they never act on a stale page. */
  const controls = useRef({ resume, pause, stop, step });
  useEffect(() => {
    controls.current = { resume, pause, stop, step };
  });

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => controls.current.resume()],
      ["pause", () => controls.current.pause()],
      ["stop", () => controls.current.stop()],
      ["previoustrack", () => controls.current.step(-1)],
      ["nexttrack", () => controls.current.step(1)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        /* An action this browser does not know. The rest still work. */
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          /* As above. */
        }
      }
    };
  }, []);

  const current = index === null ? null : ayahs[index];
  const nowPlaying = current
    ? perAyah
      ? t("nowPlaying", { ayah: `${current.s}:${current.a}` })
      : t("nowPlayingSurah")
    : null;

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator))
      return;
    if (!nowPlaying || typeof MediaMetadata === "undefined") {
      navigator.mediaSession.metadata = null;
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: nowPlaying,
      artist: reciter.name[locale],
    });
  }, [nowPlaying, reciter, locale]);

  function sourceFor(id: string, at: number): string {
    const r = reciterById(id);
    return r.kind === "ayah"
      ? ayahAudioUrl(id, ayahs[at].s, ayahs[at].a)
      : surahAudioUrl(id, ayahs[at].s);
  }

  /**
   * Play whatever the element now points at.
   *
   * A play() that is overtaken by a new src — skipping on before the last
   * verse had loaded — rejects with AbortError. That is not a failure: the
   * verse that replaced it is on its way. Reporting it as one put "that ayah
   * would not play" over a verse that was playing perfectly well.
   */
  function start(audio: HTMLAudioElement) {
    void audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoading(false);
      setFailed(true);
    });
  }

  /**
   * Start the ayah at `next`.
   *
   * `basmala` is false when repeating one ayah: the opening belongs to
   * arriving at a surah, not to every repetition of its first verse. `pass`
   * is which hearing of it this is.
   */
  function playAt(
    next: number,
    { basmala: withBasmala = true, pass: hearing = 0 } = {},
  ) {
    if (next < 0 || next >= ayahs.length) return stop();

    setIndex(next);
    setPass(hearing);
    setFailed(false);
    setLoading(true);
    setPosition(0);
    setDuration(0);

    const audio = audioRef.current;
    if (!audio) return;

    /* Only for a reciter read verse by verse. A whole-surah file has already
       said the Basmala in its own opening seconds. */
    const target = ayahs[next];
    const basmala =
      perAyah && withBasmala && opensWithBasmala(target.s, target.a);

    audio.src = basmala
      ? basmalaAudioUrl(reciter.id)
      : sourceFor(reciter.id, next);
    /* Written to the element, because the element is what survives a language
       switch — the React state does not. */
    audio.dataset.index = String(next);
    audio.dataset.pageKey = pageKey;
    if (basmala) audio.dataset.basmala = "1";
    else delete audio.dataset.basmala;
    setSayingBasmala(basmala);

    start(audio);

    /* And what comes after it, so the next file is not waited for. Only for a
       per-ayah reciter — a whole-surah file has nothing queued behind it.

       When the Basmala is sounding, the very next thing needed is the ayah it
       opens, not the one after that: warming ahead of the ayah while skipping
       the ayah itself left exactly the gap this is meant to close. */
    if (perAyah) {
      const upcoming = basmala ? [next, next + 1] : [next + 1, next + 2];

      warm(
        upcoming
          .filter((ahead) => ahead >= 0 && ahead < ayahs.length)
          .map((ahead) => sourceFor(reciter.id, ahead)),
      );
    }
  }

  function resume() {
    const audio = audioRef.current;
    if (!audio) return;
    if (index === null) return playAt(0);
    /* A verse that failed to load will not play by being asked again; it has
       to be fetched again. */
    if (failed || !audio.getAttribute("src")) return playAt(index, { pass });
    start(audio);
  }

  function pause() {
    audioRef.current?.pause();
  }

  function toggle() {
    if (index !== null && !paused) pause();
    else resume();
  }

  /** Back to nothing: no verse lit, and play starts from the top again. */
  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      delete audio.dataset.index;
      delete audio.dataset.basmala;
      delete audio.dataset.autostart;
    }
    setIndex(null);
    setPass(0);
    setSayingBasmala(false);
    setLoading(false);
    setFailed(false);
    setPosition(0);
    setDuration(0);
  }

  /** The ayah before or after this one, on this page. */
  function step(by: 1 | -1) {
    if (index === null) return by === 1 ? playAt(0) : undefined;
    const to = index + by;
    if (to >= 0 && to < ayahs.length) playAt(to);
  }

  /* Changing reciter mid-page restarts where you are in the new voice rather
     than jumping to the top — which is what you want when you switched
     because you could not follow the last one. */
  function chooseReciter(id: string) {
    writeLocal(RECITER_KEY, id);
    const audio = audioRef.current;
    if (index === null || !audio) return;
    const wasPlaying = !paused;

    /* Only a verse-by-verse reciter has a separate Basmala. Moving to one who
       recites the whole surah skips straight to the verse. */
    const basmala =
      audio.dataset.basmala === "1" && reciterById(id).kind === "ayah";
    if (!basmala) delete audio.dataset.basmala;
    setSayingBasmala(basmala);
    setFailed(false);

    audio.src = basmala ? basmalaAudioUrl(id) : sourceFor(id, index);
    if (wasPlaying) start(audio);
  }

  function chooseRepeat(times: number) {
    writeLocal(REPEAT_KEY, times === Infinity ? "inf" : String(times));
    /* The old switch would otherwise bring "forever" back after "once". */
    writeLocal(LEGACY_REPEAT_KEY, "false");
    /* Counting starts again from the hearing now sounding. */
    setPass(0);
  }

  function cycleRepeat() {
    const at = (REPEATS as readonly number[]).indexOf(repeatTimes);
    chooseRepeat(REPEATS[(at + 1) % REPEATS.length]);
  }

  const started = index !== null;
  const playing = started && !paused;
  /* Everything that is set once and then left alone — speed, which voice, what
     to keep for offline — lives behind this. Only the transport stays out. */
  const [options, setOptions] = useState(false);

  const ends: { mode: EndMode; label: string }[] = [
    { mode: "stop", label: t("endStop") },
    { mode: "repeat", label: t("endRepeat") },
    ...(nextHref ? [{ mode: "next" as const, label: t("endNext") }] : []),
  ];

  return (
    <div className="rounded-2xl border border-[var(--line-strong)] bg-[var(--surface-raised)]/40 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          data-recitation-toggle
          aria-label={playing ? t("pause") : t("play")}
          title={playing ? t("pause") : t("play")}
          className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-ground)] text-[var(--on-accent)] transition-[background-color] duration-300 hover:bg-[var(--accent-strong)]"
        >
          {loading && playing ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : playing ? (
            <Pause className="h-4.5 w-4.5" />
          ) : (
            <Play className="h-4.5 w-4.5 translate-x-px" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[0.8125rem] font-medium text-[var(--text-strong)]">
            <Volume2 className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
            <span className="truncate">{reciter.name[locale]}</span>
          </p>
          <p
            aria-live="polite"
            className="mt-0.5 truncate text-[0.75rem] text-[var(--text-muted)]"
          >
            {!started
              ? t("idle")
              : failed
                ? t("failed")
                : paused
                  ? t("paused")
                  : nowPlaying}
            {started && !failed && perAyah && repeatTimes > 1 && (
              <span className="ms-1.5 text-[var(--text-faint)] tabular-nums">
                · {pass + 1}/{repeatTimes === Infinity ? "∞" : repeatTimes}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOptions((open) => !open)}
          aria-expanded={options}
          aria-label={t("options")}
          title={t("options")}
          className={cn(
            "inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors duration-300",
            options
              ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
              : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* ── Transport ──
          Its own row, at every width. These used to sit beside the reciter's
          name and were hidden on a phone to make room — with nowhere else to
          find them, so on the device most people listen on there was no way
          to repeat a verse, skip one or stop. */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-3">
        <div className="flex items-center gap-1.5">
          {perAyah && (
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={index === null || index <= 0}
              aria-label={t("previous")}
              title={t("previous")}
              className={transportButton}
            >
              <SkipBack className="h-4 w-4 rtl:rotate-180" />
            </button>
          )}

          <button
            type="button"
            onClick={stop}
            disabled={!started}
            aria-label={t("stop")}
            title={t("stop")}
            className={transportButton}
          >
            <Square className="h-3.5 w-3.5" />
          </button>

          {perAyah && (
            <button
              type="button"
              onClick={() => step(1)}
              disabled={index !== null && index >= ayahs.length - 1}
              aria-label={t("next")}
              title={t("next")}
              className={transportButton}
            >
              <SkipForward className="h-4 w-4 rtl:rotate-180" />
            </button>
          )}
        </div>

        {/* Both only mean anything for a reciter with one file per verse, so
            they are not shown for one without. */}
        {perAyah && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleRepeat}
              aria-pressed={repeatTimes > 1}
              aria-label={`${t("repeatEach")}: ${repeatLabel(repeatTimes)}`}
              title={`${t("repeatEach")}: ${repeatLabel(repeatTimes)}`}
              className={cn(toggleButton(repeatTimes > 1), "relative")}
            >
              <Repeat className="h-4 w-4" />
              {repeatTimes > 1 && (
                <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--accent-ground)] px-1 text-[0.5625rem] leading-none font-semibold text-[var(--on-accent)] tabular-nums">
                  {repeatTimes === Infinity ? "∞" : repeatTimes}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => writeLocal(FOLLOW_KEY, String(!follow))}
              aria-pressed={follow}
              aria-label={t("follow")}
              title={t("follow")}
              className={cn(
                toggleButton(follow),
                "text-[0.6875rem] font-semibold",
              )}
            >
              ↧
            </button>
          </div>
        )}
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
            style={{
              ["--played" as string]: `${(position / duration) * 100}%`,
            }}
          />

          <span className="w-9 shrink-0 text-end text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
            {clock(duration)}
          </span>
        </div>
      )}

      {options && (
        <>
          {/* ── Repeat ── */}
          {perAyah && (
            <OptionRow label={t("repeatEach")}>
              {REPEATS.map((times) => (
                <button
                  key={times}
                  type="button"
                  onClick={() => chooseRepeat(times)}
                  aria-pressed={times === repeatTimes}
                  title={times === Infinity ? t("repeatForever") : undefined}
                  className={chip(times === repeatTimes, "tabular-nums")}
                >
                  {repeatLabel(times)}
                </button>
              ))}
            </OptionRow>
          )}

          {/* ── At the end ── */}
          <OptionRow label={t("atEnd")}>
            {ends.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => writeLocal(END_KEY, mode)}
                aria-pressed={mode === atEnd}
                className={chip(mode === atEnd)}
              >
                {label}
              </button>
            ))}
          </OptionRow>

          {/* ── Speed ── */}
          <OptionRow label={t("speed")}>
            {SPEEDS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => writeLocal(SPEED_KEY, String(option))}
                aria-pressed={option === speed}
                className={chip(option === speed, "tabular-nums")}
              >
                {option}&times;
              </button>
            ))}
          </OptionRow>

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

          {extra && <div className="mt-4">{extra}</div>}
        </>
      )}

      {failed && (
        <p role="alert" className="mt-3 text-[0.75rem] text-danger">
          {t("failedHelp")}
        </p>
      )}
    </div>
  );
}

const transportButton =
  "inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--line-strong)] text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--text-strong)] disabled:pointer-events-none disabled:opacity-35";

function toggleButton(on: boolean): string {
  return cn(
    "inline-grid h-9 w-9 place-items-center rounded-full border transition-colors duration-300",
    on
      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] text-[var(--accent-strong)]"
      : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
  );
}

function chip(on: boolean, extra?: string): string {
  return cn(
    "rounded-full border px-2.5 py-1 text-[0.6875rem]",
    "transition-[border-color,background-color,color] duration-300",
    on
      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
      : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
    extra,
  );
}

/** One labelled line of choices in the options panel. */
function OptionRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      <span className="me-1 text-[0.6875rem] tracking-[0.1em] text-[var(--text-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** "1:07". Seconds only; no recitation of one ayah runs to an hour. */
function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
