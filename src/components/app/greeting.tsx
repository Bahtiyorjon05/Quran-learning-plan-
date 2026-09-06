"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun, Sunrise, Sunset } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The line above your name, and the hour it belongs to.
 *
 * The ground behind this screen already knows whether it is before Fajr or
 * after Isha — it warms toward dawn and cools toward night. The greeting did
 * not, which meant the one piece of text that speaks directly to the reader
 * said exactly the same thing at five in the morning and eleven at night.
 *
 * Read from the browser, not the server: a server in Frankfurt renders one
 * hour for everybody, and this is a fact about where the reader is sitting.
 * The store re-reads on the hour rather than on a timer — a dashboard is often
 * left open, and sunrise is the one change worth catching.
 */

type Daypart = "dawn" | "morning" | "afternoon" | "dusk" | "night";

function daypartAt(hour: number): Daypart {
  if (hour >= 4 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "dusk";
  return "night";
}

function subscribe(onChange: () => void) {
  const now = new Date();
  const msToHour =
    3_600_000 - (now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds());
  const id = setTimeout(onChange, msToHour + 500);
  return () => clearTimeout(id);
}

function useDaypart(): Daypart {
  return useSyncExternalStore(
    subscribe,
    () => daypartAt(new Date().getHours()),
    /* The server has no hour of its own worth guessing; morning is the least
       wrong thing to render before the browser corrects it. */
    () => "morning" as Daypart,
  );
}

const ICON = {
  dawn: Sunrise,
  morning: Sun,
  afternoon: Sun,
  dusk: Sunset,
  night: Moon,
} as const;

export function Greeting({ name }: { name: string }) {
  const t = useTranslations("app.greeting");
  const daypart = useDaypart();
  const Icon = ICON[daypart];

  return (
    <div className="min-w-0">
      <p className="flex items-center gap-3 text-[0.8125rem] tracking-[0.14em] text-gold-ink/80 uppercase">
        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
        {t(daypart)}
        <span
          aria-hidden
          className="h-px w-10 shrink-0 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--gold)_45%,transparent),transparent)] rtl:bg-[linear-gradient(270deg,color-mix(in_oklab,var(--gold)_45%,transparent),transparent)]"
        />
      </p>

      <p
        className="font-arabic mt-2 text-lg text-gold-ink/70"
        dir="rtl"
        aria-hidden
      >
        السلام عليكم
      </p>

      <h1
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-[2rem] leading-tight font-light sm:text-[2.75rem]",
          /* The name catches the light rather than sitting flat on the page. */
          "ahd-name bg-clip-text text-transparent",
        )}
      >
        {name}
      </h1>
    </div>
  );
}
