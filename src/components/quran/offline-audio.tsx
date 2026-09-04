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
 * Keep this page, this surah or this juz for reading and listening offline.
 *
 * The honest version of "works offline". Nothing is fetched behind anybody's
 * back — the whole Qur'an in one voice is hundreds of megabytes, and quietly
 * pulling that down on a metered phone would be an abuse of trust — so it is
 * asked for, at a size the reader chooses.
 *
 * A page was the only choice before, which turned out to be the wrong unit for
 * the thing people actually do: somebody about to lose signal wants Ya-Sin, or
 * the juz they are revising, not page 440 on its own and then page 441.
 *
 * The pages come with the audio. Downloading only the recitation left a reader
 * offline with a surah they could hear and could not see, because the page
 * itself was never in the cache — which is exactly what happened.
 *
 * Tied to the chosen reciter, because that is what the files are. Choosing a
 * different voice means a different download, and the label says so rather
 * than letting somebody discover it on a train.
 */

const RECITER_KEY = "ahd-reciter";

export type OfflineScope = {
  /** "page-3", "surah-2", "juz-30" — stable, and what the download is keyed by. */
  unit: string;
  kind: "page" | "surah" | "juz";
  ayahs: { s: number; a: number }[];
  /** Mushaf pages this covers, so the text can be read as well as heard. */
  pages: number[];
};

export function OfflineAudio({ scopes }: { scopes: OfflineScope[] }) {
  const t = useTranslations("quran.offline");
  const locale = useLocale();

  const chosen = reciterById(useLocalValue(RECITER_KEY) ?? "");
  const [pick, setPick] = useState(0);
  const scope = scopes[Math.min(pick, scopes.length - 1)];
  const key = `${scope?.unit ?? "none"}-${chosen.id}`;

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

  /* A download in flight belongs to the scope it was started for. */
  useEffect(() => () => abort.current?.abort(), []);

  if (!canStore) {
    return <p className="text-[0.75rem] text-[var(--text-faint)]">{t("unsupported")}</p>;
  }
  if (!scope) return null;

  /* Uzbek carries no prefix; the other two do. The page has to be asked for at
     the address the reader will later navigate to, or the cache is keyed to
     something nobody visits. */
  const prefix = locale === "uz" ? "" : `/${locale}`;
  /* Relative, not absolute. This component is server-rendered before it is
     hydrated — every client component is — and reaching for `window` here threw
     during render, which turned every page of the reader into a 500. `fetch`
     and `cache.put` both resolve a path against the document, so the key ends
     up as the same absolute URL the browser will later ask for. */
  const pageUrls = scope.pages.map((page) => `${prefix}/quran/${page}`);

  /* Every file the player will ask for, which is not quite every ayah: a surah
     that opens with the Basmala asks for that first, and a download without it
     is silent from its very first request. Deduplicated, because Al-Fatiha's
     first ayah is the Basmala. */
  const audioUrls =
    chosen.kind === "ayah"
      ? [
          ...new Set([
            ...(scope.ayahs.some((a) => opensWithBasmala(a.s, a.a))
              ? [basmalaAudioUrl(chosen.id)]
              : []),
            ...scope.ayahs.map((a) => ayahAudioUrl(chosen.id, a.s, a.a)),
          ]),
        ]
      : [];

  const urls = [...pageUrls, ...audioUrls];

  async function download() {
    setBusy(true);
    setFailed(false);
    const controller = new AbortController();
    abort.current = controller;

    try {
      const saved = await saveForOffline(
        key,
        urls,
        scope.ayahs.length,
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
            disabled={busy || urls.length === 0}
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

      {/* How much to keep. Offered before the button, because the size of the
          thing is the decision — the button is only the consequence. */}
      {scopes.length > 1 && !info && !busy && (
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {scopes.map((option, i) => (
            <button
              key={option.unit}
              type="button"
              onClick={() => setPick(i)}
              aria-pressed={i === pick}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.75rem] transition-colors duration-300",
                i === pick
                  ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] font-medium text-[var(--accent-strong)]"
                  : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
              )}
            >
              {t(
                option.kind === "page"
                  ? "scopePage"
                  : option.kind === "surah"
                    ? "scopeSurah"
                    : "scopeJuz",
              )}
              <span className="ms-1.5 text-[var(--text-faint)] tabular-nums">
                {t("pages", { count: option.pages.length })}
              </span>
            </button>
          ))}
        </div>
      )}

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
        {failed
          ? t("failed")
          : info
            ? t("reciterNote", { reciter: chosen.name[locale as "uz" | "en" | "ru"] })
            : t("readable")}
      </p>
    </div>
  );
}
