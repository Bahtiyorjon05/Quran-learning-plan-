import { getTranslations } from "next-intl/server";
import { ArrowRight, Sparkles } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * An invitation to drill, naming the page that actually needs it.
 *
 * "Practice" as a bare link gets ignored. "Page 47 is at 22% and you last
 * recited it three weeks ago" is a reason to click, and the reason is true —
 * it comes from the same strength model the revision tracks use.
 */
export async function PracticeInvite({
  weakest,
  fragileCount,
  held,
}: {
  weakest: { page: number; strength: number; surahNames: string[]; daysSinceReview: number } | null;
  fragileCount: number;
  held: number;
}) {
  const t = await getTranslations("app.practiceInvite");

  if (held === 0) return null;

  const urgent = fragileCount > 0;

  return (
    <Link
      href={weakest ? `/app/practice/${weakest.page}` : "/app/practice"}
      className={cn(
        "group panel panel-interactive flex items-center gap-4 rounded-2xl p-5 sm:p-6",
        urgent && "!border-gold-500/40 hover:!border-gold-500/70",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
          urgent
            ? "border-gold-500/30 bg-gold-500/10"
            : "border-[var(--line-subtle)] bg-[var(--surface-overlay)]",
        )}
      >
        <Sparkles
          className={cn("h-4.5 w-4.5", urgent ? "text-gold-ink" : "text-[var(--accent)]")}
          strokeWidth={1.6}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium text-[var(--text-strong)]">
          {urgent ? t("fragile", { count: fragileCount }) : t("title")}
        </span>
        <span className="mt-1 block text-[0.8125rem] leading-relaxed text-[var(--text-muted)]">
          {weakest
            ? t("weakest", {
                name: weakest.surahNames[0] ?? "",
                page: weakest.page,
                strength: weakest.strength,
              })
            : t("body")}
        </span>
      </span>

      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-faint)] transition-transform duration-300 group-hover:translate-x-0.5 rtl:rotate-180" />
    </Link>
  );
}
