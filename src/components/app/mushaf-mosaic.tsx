"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { MosaicGrid, MosaicLegend, type Band } from "@/components/landing/mosaic-grid";

/**
 * The whole mushaf as 604 tiles, coloured by how strongly each page is held.
 *
 * The landing page shows a seeded imitation of this; here the numbers are the
 * reader's own. Clicking a tile opens that page, which makes the picture a way
 * of navigating rather than only a way of looking.
 */
export function MushafMosaic({
  strengths,
  held,
  averageStrength,
  basePath,
}: {
  strengths: number[];
  held: number;
  averageStrength: number;
  basePath: string;
}) {
  const t = useTranslations("app.mushaf");
  const tl = useTranslations("landing.mosaic");
  const router = useRouter();
  const [hovered, setHovered] = useState<number | null>(null);

  const labels: Record<Band, string> = {
    none: tl("legendNotStarted"),
    learning: tl("legendLearning"),
    weak: tl("legendWeak"),
    strong: tl("legendStrong"),
  };

  return (
    <section className="mt-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
        <div className="rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/50 p-4 sm:p-6">
          <MosaicGrid
            strengths={strengths}
            interactive
            onHoverPage={setHovered}
            onSelectPage={(page) => router.push(`${basePath}/${page}`)}
          />
        </div>

        <div className="space-y-5">
          <Stat label={t("pagesHeld", { count: held })} value={held} suffix="/ 604" />
          <Stat label={t("strength")} value={averageStrength} suffix="%" />

          <MosaicLegend labels={labels} className="flex-col !items-start gap-2" />

          <p className="border-t border-[var(--line-subtle)] pt-4 text-xs leading-relaxed text-[var(--text-faint)]">
            {hovered ? t("openPage", { page: hovered }) : t("hint")}
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-display)] text-3xl leading-none font-light text-[var(--text-strong)] tabular-nums">
        {value}
        <span className="ms-1 text-base text-[var(--text-faint)]">{suffix}</span>
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
