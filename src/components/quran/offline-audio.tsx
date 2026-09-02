"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Download, Loader2, Trash2, WifiOff } from "lucide-react";

import {
  ayahAudioUrl,
  basmalaAudioUrl,
  opensWithBasmala,
  reciter as reciterById,
} from "@/lib/reciters";
import { useLocalValue, useSupports } from "@/lib/client-store";
import {
  decodeSaved,
  forgetSaved,
  noSavedSnapshot,
  rememberSaved,
  saveForOffline,
  savedSnapshot,
  subscribeSaved,
} from "@/lib/offline-audio";
import { cn } from "@/lib/utils";

/**
 * Download this surah, or this juz, to listen to without a connection.
 *
 * The honest version of "works offline". Nothing is fetched behind anybody's
 * back: the whole Qur'an in one voice is hundreds of megabytes, and quietly
 * pulling that down on a metered phone would be an abuse of trust. So it is
 * asked for, one juz or one surah at a time, and the size is shown once it is
 * known.
 *
 * Tied to the chosen reciter, because that is what the files are. Choosing a
 * different voice means a different download, and the label says so rather
 * than letting somebody discover it on a train.
 */

const RECITER_KEY = "ahd-reciter";

export function OfflineAudio({
  unit,
  ayahs,
}: {
  /** Stable name for what is being kept: "juz-30", "surah-36". */
  unit: string;
  ayahs: { s: number; a: number }[];
}) {
  const t = useTranslations("quran.offline");
  const locale = useLocale();

  const chosen = reciterById(useLocalValue(RECITER_KEY) ?? "");
  const key = `${unit}-${chosen.id}`;

  /* Read through the store, whose server answer is "yes". Calling the browser
     check directly during render made the server say no and the client say
     yes — a hydration mismatch, and React tore the panel out and rebuilt it. */
  const canStore = useSupports("caches");

  /* Read through the store, so the first render already has the right answer
     and nobody is offered a download they have already paid for. */
  const info = decodeSaved(
    useSyncExternalStore(subscribeSaved(key), savedSnapshot(key), noSavedSnapshot),
  );

  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const abort = useRef<AbortController | null>(null);

  /* Per-ayah files only. A reciter recorded one file per surah is a different
     shape of thing, and downloading a whole surah's single file is what
     pressing play already does. */
  /* Every file the player will ask for, which is not quite every ayah: a
     surah that opens with the Basmala asks for that first, and a download
     without it is silent from its very first request. Deduplicated, because
     Al-Fatiha's first ayah is the Basmala. */
  const urls =
    chosen.kind === "ayah"
      ? [
          ...new Set([
            ...(ayahs.some((a) => opensWithBasmala(a.s, a.a))
              ? [basmalaAudioUrl(chosen.id)]
              : []),
            ...ayahs.map((a) => ayahAudioUrl(chosen.id, a.s, a.a)),
          ]),
        ]
      : [];

  /* A download in flight belongs to the unit it was started for. */
  useEffect(() => () => abort.current?.abort(), []);

  if (!canStore) {
    return <p className="text-[0.75rem] text-[var(--text-faint)]">{t("unsupported")}</p>;
  }

  if (urls.length === 0) return null;

  async function download() {
    setBusy(true);
    setFailed(false);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const saved = await saveForOffline(
        key,
        urls,
        ayahs.length,
        (n) => setDone(n),
        controller.signal,
      );
      rememberSaved(key, saved);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") setFailed(true);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  async function remove() {
    setBusy(true);
    await forgetSaved(key, urls);
    rememberSaved(key, null);
    setDone(0);
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-[var(--line-subtle)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2.5 text-[0.875rem] font-medium text-[var(--text-strong)]">
          <WifiOff className="h-4 w-4 shrink-0 text-[var(--text-faint)]" strokeWidth={1.7} />
          {t("title")}
        </span>

        {info ? (
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-[var(--accent-strong)]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t("saved", { count: info.count })}
            </span>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label={t("remove")}
              className="inline-grid h-8 w-8 place-items-center rounded-full border border-[var(--line-subtle)] text-[var(--text-faint)] transition-colors duration-300 hover:border-danger/50 hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={download}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 text-[0.8125rem] font-medium text-[var(--accent-strong)] transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--accent)_18%,transparent)] disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("saving", { done, total: urls.length })}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                {t("save")}
              </>
            )}
          </button>
        )}
      </div>

      {/* A real bar while it runs: "downloading" with no end in sight is the
          part people abandon. */}
      {busy && (
        <span
          aria-hidden
          className="mt-3 block h-1 overflow-hidden rounded-full bg-[var(--line-strong)]"
        >
          <span
            className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-300 ease-[var(--ease-calm)]"
            style={{ width: `${Math.max(2, (done / Math.max(1, urls.length)) * 100)}%` }}
          />
        </span>
      )}

      <p
        className={cn(
          "mt-2.5 text-[0.75rem] leading-relaxed",
          failed ? "text-danger" : "text-[var(--text-faint)]",
        )}
      >
        {failed ? t("failed") : info ? t("reciterNote", { reciter: chosen.name[locale as "uz" | "en" | "ru"] }) : t("hint")}
      </p>
    </div>
  );
}
