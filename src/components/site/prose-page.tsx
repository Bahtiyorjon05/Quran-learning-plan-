import { AhdMark } from "@/components/brand/logo";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Measure } from "@/components/ui/section";

/**
 * The frame for pages that are mostly words.
 *
 * One measure, one rhythm. These are read rather than used, so the column is
 * narrow enough to track a line without effort and the type is larger than the
 * interface elsewhere.
 */
export function ProsePage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main" className="pt-16 sm:pt-18">
        <section className="relative overflow-hidden border-b border-[var(--line-subtle)] py-16 sm:py-20">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="animate-breathe absolute start-1/2 top-[-18rem] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--halo),transparent_65%)] blur-3xl" />
            <div className="girih absolute inset-0 opacity-[0.035]" />
          </div>

          <Measure>
            <div className="animate-rise mx-auto max-w-2xl text-center">
              <div className="mx-auto w-fit">
                <AhdMark size={56} />
              </div>
              <h1 className="mt-7 font-[family-name:var(--font-display)] text-[2.25rem] leading-[1.1] font-light text-balance text-[var(--text-strong)] sm:text-[3rem]">
                {title}
              </h1>
              {lead && (
                <p className="mt-5 text-[1.0625rem] leading-[1.7] text-[var(--text-muted)]">
                  {lead}
                </p>
              )}
              {updated && (
                <p className="mt-6 text-xs tracking-[0.14em] text-[var(--text-faint)] uppercase">
                  {updated}
                </p>
              )}
            </div>
          </Measure>
        </section>

        <Measure className="py-14 sm:py-20">
          <div className="mx-auto max-w-2xl">{children}</div>
        </Measure>
      </main>
      <Footer />
    </>
  );
}

/** A titled block of prose. */
export function ProseSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="font-[family-name:var(--font-display)] text-[1.5rem] leading-snug font-normal text-[var(--text-strong)] sm:text-[1.75rem]">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-[1rem] leading-[1.75] text-[var(--text-muted)]">
        {children}
      </div>
    </section>
  );
}
