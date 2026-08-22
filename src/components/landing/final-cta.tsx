import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { AhdMark } from "@/components/brand/logo";
import { Measure } from "@/components/ui/section";

export function FinalCta() {
  const t = useTranslations("landing.cta");

  return (
    <section className="relative overflow-hidden py-28 sm:py-36">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-breathe absolute start-1/2 bottom-[-20rem] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--halo),transparent_62%)] blur-3xl" />
        <div className="girih absolute inset-0 opacity-[0.03]" />
      </div>

      <Measure>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <AhdMark size={88} />

          <h2 className="mt-8 font-[family-name:var(--font-display)] text-[2.25rem] leading-[1.06] font-light tracking-[-0.02em] text-balance sm:text-5xl lg:text-[3.5rem]">
            {t("title")}
          </h2>

          <p className="mt-6 text-[1.0625rem] leading-[1.75] text-[var(--text-muted)]">
            {t("body")}
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className={buttonStyles({ size: "lg", className: "group" })}
            >
              {t("button")}
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
            </Link>
            <Link
              href="/#covenant"
              className={buttonStyles({ variant: "ghost", size: "lg" })}
            >
              {t("secondary")}
            </Link>
          </div>

          <p className="mt-6 text-xs text-[var(--text-faint)]">{t("note")}</p>
        </div>
      </Measure>
    </section>
  );
}
