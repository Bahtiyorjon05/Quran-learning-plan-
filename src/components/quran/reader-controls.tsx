"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Languages, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZE_KEY = "ahd-arabic-size";
const TRANSLATION_KEY = "ahd-show-translation";
const READ_KEY = "ahd-pages-read";

const MIN_SIZE = 80;
const MAX_SIZE = 200;
const STEP = 15;

/** Pages marked read on this device, as a set of page numbers. */
function loadRead(): Set<number> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function saveRead(pages: Set<number>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...pages].sort((a, b) => a - b)));
  } catch {
    /* Private mode or blocked storage. Reading still works; only the mark is lost. */
  }
}

/**
 * Reading settings and the read-marker.
 *
 * All of it lives in localStorage, because the public reader has no account by
 * design. The size is written to a CSS custom property on the document rather
 * than held in React state, so the Arabic — rendered on the server — resizes
 * without re-rendering a single ayah.
 */
export function ReaderControls({ page }: { page: number }) {
  const t = useTranslations("quran.reader");

  const [size, setSize] = useState(100);
  const [showTranslation, setShowTranslation] = useState(true);
  const [read, setRead] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const storedSize = Number(localStorage.getItem(SIZE_KEY));
      if (storedSize >= MIN_SIZE && storedSize <= MAX_SIZE) setSize(storedSize);

      const storedTranslation = localStorage.getItem(TRANSLATION_KEY);
      if (storedTranslation !== null) setShowTranslation(storedTranslation === "true");

      setRead(loadRead());
    } catch {
      /* Defaults are already correct. */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.style.setProperty("--arabic-scale", String(size / 100));
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {}
  }, [size, ready]);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.translation = showTranslation ? "on" : "off";
    try {
      localStorage.setItem(TRANSLATION_KEY, String(showTranslation));
    } catch {}
  }, [showTranslation, ready]);

  const isRead = read.has(page);

  function toggleRead() {
    const next = new Set(read);
    if (next.has(page)) next.delete(page);
    else next.add(page);
    setRead(next);
    saveRead(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-full border border-[var(--line-strong)]">
        <button
          type="button"
          onClick={() => setSize((s) => Math.max(MIN_SIZE, s - STEP))}
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
          onClick={() => setSize((s) => Math.min(MAX_SIZE, s + STEP))}
          disabled={size >= MAX_SIZE}
          aria-label={`${t("fontSize")} +`}
          className="grid h-9 w-9 place-items-center rounded-e-full text-[var(--text-muted)] transition-colors hover:text-[var(--text-strong)] disabled:opacity-35"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowTranslation((v) => !v)}
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
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => setCount(loadRead().size), []);

  if (!count) return null;
  return (
    <p className="text-sm text-[var(--text-faint)] tabular-nums">
      {t("readCount", { count })}
    </p>
  );
}
