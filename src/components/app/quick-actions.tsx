"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  LayoutGrid,
  ScrollText,
  Sparkles,
  Sprout,
  Target,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { lastPage, subscribeLastPage } from "@/lib/last-page";
import { cn } from "@/lib/utils";

/**
 * The six things somebody opens the app to do, one tap each.
 *
 * The dashboard is a lot of reading — the covenant, the day's three tracks,
 * the seals, the mosaic — and the most common visit is not to read any of it
 * but to get *somewhere*: back to the page they were on, into today's lesson,
 * into a drill. Those used to be reached by scrolling to the right panel and
 * finding the right link inside it. Now they are the first thing under the
 * greeting, as large as a thumb, each saying where it will take you before it
 * does.
 */
export function QuickActions({
  sabaq,
  weakest,
  weakAyahs,
  held,
}: {
  /** Today's new portion: where it starts, and whether it is ticked. */
  sabaq: { page: number; done: boolean } | null;
  /** The weakest held page, for a drill. */
  weakest: number | null;
  /** Ayahs with an open weak spot. */
  weakAyahs: number;
  /** Whole pages held. */
  held: number;
}) {
  const t = useTranslations("app.quick");

  /* Read on the client only — the server has no idea which page this device
     was last on, and must not guess. Until it knows, "continue" points at
     today's lesson, which is the right answer for a first visit anyway. */
  const remembered = useSyncExternalStore(subscribeLastPage, lastPage, () => null);
  const continueAt = remembered ?? sabaq?.page ?? 1;

  const actions: Action[] = [
    {
      key: "continue",
      href: `/app/quran/${continueAt}`,
      icon: BookOpen,
      title: t("continue"),
      detail: t("onPage", { page: continueAt }),
      tone: "accent",
    },
    {
      key: "sabaq",
      href: sabaq ? `/app/quran/${sabaq.page}` : "/app",
      icon: sabaq?.done ? Check : Sprout,
      title: t("sabaq"),
      detail: !sabaq ? t("sabaqNone") : sabaq.done ? t("sabaqDone") : t("onPage", { page: sabaq.page }),
      tone: sabaq?.done ? "done" : "plain",
    },
    {
      key: "practice",
      href: weakest ? `/app/practice/${weakest}` : "/app/practice",
      icon: Sparkles,
      title: t("practice"),
      detail: weakest ? t("weakestPage", { page: weakest }) : t("practiceNone"),
      tone: "plain",
    },
    {
      key: "weak",
      href: "/app/mistakes",
      icon: Target,
      title: t("weak"),
      detail: weakAyahs > 0 ? t("weakCount", { count: weakAyahs }) : t("weakNone"),
      tone: weakAyahs > 0 ? "gold" : "plain",
    },
    {
      key: "mushaf",
      href: "/app/quran",
      icon: LayoutGrid,
      title: t("mushaf"),
      detail: t("heldCount", { count: held }),
      tone: "plain",
    },
    {
      key: "covenant",
      href: "/app/plan",
      icon: ScrollText,
      title: t("covenant"),
      detail: t("covenantDetail"),
      tone: "plain",
    },
  ];

  return (
    <nav aria-label={t("title")} className="animate-rise mt-7 [animation-delay:40ms]">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((action) => (
          <li key={action.key}>
            <Tile action={action} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

type Action = {
  key: string;
  href: string;
  icon: typeof BookOpen;
  title: string;
  detail: string;
  tone: "accent" | "plain" | "gold" | "done";
};

function Tile({ action }: { action: Action }) {
  const Icon = action.icon;
  const lead = action.tone === "accent";

  return (
    <Link
      href={action.href}
      className={cn(
        "group relative flex h-full min-h-[7.25rem] flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-4 transition-[transform,border-color,box-shadow,background-color] duration-300 ease-[var(--ease-calm)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] sm:p-5",
        lead
          ? "border-transparent bg-[var(--accent-ground)] text-[var(--on-accent)] shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--accent)_70%,transparent)]"
          : "panel hover:border-[var(--accent)]/45 hover:shadow-[0_14px_34px_-22px_rgba(0,0,0,0.5)]",
      )}
    >
      {/* Light in the corner of the lead tile, the way the covenant panel is
          lit — it is the one most visits are for. */}
      {lead && (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-10 -top-10 h-28 w-28 rounded-full bg-white/15 blur-2xl"
        />
      )}

      <span className="relative flex items-start justify-between gap-2">
        <span
          className={cn(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
            lead
              ? "border-white/25 bg-white/15"
              : action.tone === "gold"
                ? "border-[var(--gold)]/35 bg-[color-mix(in_oklab,var(--gold)_14%,transparent)] text-gold-ink"
                : action.tone === "done"
                  ? "border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]"
                  : "border-[var(--line-subtle)] bg-[var(--surface-overlay)] text-[var(--accent)]",
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
        <ArrowUpRight
          aria-hidden
          className={cn(
            "h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100",
            lead ? "text-white/70" : "text-[var(--text-faint)] group-hover:text-[var(--accent)]",
          )}
        />
      </span>

      <span className="relative min-w-0">
        <span
          className={cn(
            "block text-[1.0625rem] leading-tight font-semibold",
            lead ? "text-[var(--on-accent)]" : "text-[var(--text-strong)]",
          )}
        >
          {action.title}
        </span>
        <span
          className={cn(
            "mt-1 line-clamp-2 block text-[0.875rem] leading-snug",
            lead ? "text-[var(--on-accent)]/80" : "text-[var(--text-muted)]",
          )}
        >
          {action.detail}
        </span>
      </span>
    </Link>
  );
}
