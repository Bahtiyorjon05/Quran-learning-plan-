"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Check, Languages, Minus, Plus } from "lucide-react";

import { useLocalValue, writeLocal } from "@/lib/client-store";
import { cn } from "@/lib/utils";

const SIZE_KEY = "ahd-arabic-size";
const TRANSLATION_KEY = "ahd-show-translation";
const READ_KEY = "ahd-pages-read";

const MIN_SIZE = 80;
const MAX_SIZE = 200;
const STEP = 15;

function parsePages(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === "number") : [];
  } catch {
    return [];
  }
}

/**
 * Reading settings and the read-marker.
 *
 * All of it lives in localStorage, because the public reader has no account by
 * design. It is read through an external store rather than copied into state in
 * an effect, so the first render is already right — otherwise the size would
 * visibly snap from the default to the saved value on every page turn.
 *
 * The Arabic size is written to a CSS custom property on the document, so
 * resizing never re-renders a single server-rendered ayah.
 */
export function ReaderControls({ page }: { page: number }) {
  const t = useTranslations("quran.reader");

  const storedSize = Number(useLocalValue(SIZE_KEY));
  const size = storedSize >= MIN_SIZE && storedSize <= MAX_SIZE ? storedSize : 100;

  const storedTranslation = useLocalValue(TRANSLATION_KEY);
  const showTranslation = storedTranslation !== "false";

  const rawRead = useLocalValue(READ_KEY);
  const read = useMemo(() => new Set(parsePages(rawRead)), [rawRead]);
  const isRead = read.has(page);

  useEffect(() => {
    document.documentElement.style.setProperty("--arabic-scale", String(size / 100));
  }, [size]);

  useEffect(() => {
    document.documentElement.dataset.translation = showTranslation ? "on" : "off";
  }, [showTranslation]);


  function setSize(next: number) {
    writeLocal(SIZE_KEY, String(Math.max(MIN_SIZE, Math.min(MAX_SIZE, next))));
  }

  function toggleRead() {
    const next = new Set(read);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    writeLocal(READ_KEY, JSON.stringify([...next].sort((a, b) => a - b)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-[var(--line-strong)]">
        <button
          type="button"
          onClick={() => setSize(size - STEP)}
          disabled={size <= MIN_SIZE}
          aria-label={`${t("fontSize")} −`}
          className="grid h-9 w-9 place-items-center rounded-s-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] disabled:opacity-35"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-11 text-center text-[0.6875rem] text-[var(--text-faint)] tabular-nums">
          {size}%
        </span>
        <button
          type="button"
          onClick={() => setSize(size + STEP)}
          disabled={size >= MAX_SIZE}
          aria-label={`${t("fontSize")} +`}
          className="grid h-9 w-9 place-items-center rounded-e-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] disabled:opacity-35"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => writeLocal(TRANSLATION_KEY, String(!showTranslation))}
        aria-pressed={showTranslation}
        title={showTranslation ? t("hideTranslation") : t("showTranslation")}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs transition-colors",
          showTranslation
            ? "border-[var(--accent)]/40 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] text-[var(--accent-strong)]"
            : "border-[var(--line-strong)] text-[var(--text-muted)] hover:text-[var(--text-strong)]",
        )}
      >
        <Languages className="h-3.5 w-3.5" />
        <span className="max-sm:sr-only">{t("translation")}</span>
      </button>

      <button
        type="button"
        onClick={toggleRead}
        aria-pressed={isRead}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors",
          isRead
            ? "border-[var(--accent)] bg-[var(--accent-ground)] text-[var(--on-accent)]"
            : "border-[var(--line-strong)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--text-strong)]",
        )}
      >
        <Check className="h-3.5 w-3.5" />
        {isRead ? t("marked") : t("markRead")}
      </button>
    </div>
  );
}

/** How many pages this device has marked, for the index page. */
export function ReadTally() {
  const t = useTranslations("quran.index");
  const raw = useLocalValue(READ_KEY);
  const count = parsePages(raw).length;

  if (!count) return null;
  return (
    <p className="text-sm text-[var(--text-faint)] tabular-nums">
      {t("readCount", { count })}
    </p>
  );
}
