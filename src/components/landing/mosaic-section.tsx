"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Section, Measure, Eyebrow, SectionTitle } from "@/components/ui/section";
import { MosaicGrid, MosaicLegend, type Band } from "./mosaic-grid";

const MEMORIZED = 214;

export function MosaicSection() {
  const t = useTranslations("landing.mosaic");
  const [page, setPage] = useState<number | null>(null);

  const labels: Record<Band, string> = {
    none: t("legendNotStarted"),
    learning: t("legendLearning"),
    weak: t("legendWeak"),
    strong: t("legendStrong"),
  };

  // Every juz is 604/30 ≈ 20.1 pages; close enough to name the region on hover.
  const juz = page ? Math.min(30, Math.floor((page - 1) / 20.13) + 1) : null;

  return (
    <Section id="features" className="scroll-mt-20">
      <Measure>
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
          <div>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <SectionTitle>{t("title")}</SectionTitle>
            <p className="mt-6 text-[1.0625rem] leading-[1.75] text-[var(--text-muted)]">
              {t("body")}
            </p>

            <MosaicLegend labels={labels} className="mt-8" />

            <p className="mt-8 border-t border-[var(--line-subtle)] pt-6 text-sm text-[var(--text-faint)] tabular-nums">
              {page && juz
                ? `${t("juzLabel", { number: juz })} · ${page} / 604`
                : t("pagesMemorized", { count: MEMORIZED })}
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,var(--halo),transparent_70%)] opacity-60 blur-2xl"
            />
            <div className="relative rounded-2xl border border-[var(--line-subtle)] bg-[var(--surface-raised)]/50 p-4 backdrop-blur-sm sm:p-6">
              <MosaicGrid
                memorizedPages={MEMORIZED}
                interactive
                onHoverPage={setPage}
              />
            </div>
          </div>
        </div>
      </Measure>
    </Section>
  );
}
