import { AhdMark } from "@/components/brand/logo";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Measure } from "@/components/ui/section";
import { cn } from "@/lib/utils";

/**
 * The frame for pages that are mostly words.
 *
 * These are read rather than used, so the column is narrow enough to track a
 * line without effort and the type is larger than the interface elsewhere.
 *
 * Two things beyond that, both earned by the longest pages rather than by the
 * shortest:
 *
 *   A contents rail, on wide screens only. The privacy page has nine sections
 *   and somebody arriving from a footer link usually wants one of them; making
 *   them scroll past eight is the difference between a policy that is read and
 *   one that is scrolled. It sticks, because a contents list that scrolls away
 *   is a table of contents in name only.
 *
 *   A ground that belongs to the same product as the homepage — the same slow
 *   lights and the same lattice, at a fraction of the strength. A page of terms
 *   should feel quieter than the front door, not like a different building.
 */

export type ProseHeading = { id: string; label: string };

/** A heading turned into something that can be linked to. */
export function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ProsePage({
  title,
  lead,
  updated,
  contents,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  /** Section headings, for the rail. Omit on a page with one thread. */
  contents?: ProseHeading[];
  children: React.ReactNode;
}) {
  const railed = (contents?.length ?? 0) > 2;

  return (
    <>
      <Header />
      <main id="main" className="pt-16 sm:pt-18">
        <section className="relative overflow-hidden border-b border-[var(--line-subtle)] py-16 sm:py-20">
          {/* The homepage ground, quieter: two lights instead of three, and the
              lattice at half strength. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="ahd-aurora ahd-aurora-a opacity-70" />
            <div className="ahd-aurora ahd-aurora-b opacity-50" />
            <div className="girih absolute inset-0 opacity-[0.03]" />
            <div className="ahd-grain absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-[linear-gradient(to_bottom,transparent,var(--surface-base))]" />
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
                <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--line-subtle)] px-3.5 py-1.5 text-[0.6875rem] tracking-[0.14em] text-[var(--text-faint)] uppercase">
                  {updated}
                </p>
              )}
            </div>
          </Measure>
        </section>

        <Measure className="py-14 sm:py-20">
          <div
            className={cn(
              "mx-auto",
              railed ? "lg:grid lg:max-w-5xl lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14" : "max-w-2xl",
            )}
          >
            {railed && (
              <nav
                aria-label={title}
                className="hidden lg:sticky lg:top-28 lg:block lg:self-start"
              >
                <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-[var(--text-faint)] uppercase">
                  {title}
                </p>
                <ol className="mt-4 space-y-2.5 border-s border-[var(--line-subtle)] ps-4">
                  {contents!.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block text-[0.8125rem] leading-snug text-[var(--text-muted)] transition-colors duration-300 hover:text-[var(--accent-strong)]"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className={cn(railed && "max-w-2xl")}>{children}</div>
          </div>
        </Measure>
      </main>
      <Footer />
    </>
  );
}

/**
 * A titled block of prose.
 *
 * The heading carries an id so the rail can reach it and so a section can be
 * linked to directly — which is what people actually do with a privacy policy:
 * send someone the paragraph, not the page.
 */
export function ProseSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  const id = headingId(heading);

  return (
    <section id={id} className="mt-14 scroll-mt-28 first:mt-0">
      <h2 className="group font-[family-name:var(--font-display)] text-[1.5rem] leading-snug font-normal text-[var(--text-strong)] sm:text-[1.75rem]">
        <a href={`#${id}`} className="inline-flex items-baseline gap-2.5">
          {heading}
          <span
            aria-hidden
            className="text-[1rem] text-[var(--text-faint)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          >
            #
          </span>
        </a>
      </h2>
      <div className="mt-4 space-y-4 text-[1rem] leading-[1.75] text-[var(--text-muted)]">
        {children}
      </div>
    </section>
  );
}
