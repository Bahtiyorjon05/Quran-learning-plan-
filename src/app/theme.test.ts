import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The theme must survive a language switch.
 *
 * Choosing English used to throw a light-theme reader into the dark. The cause
 * was one attribute: the locale layout rendered `data-theme="dark"` on <html>,
 * which made React the owner of it — and switching language is a client
 * navigation through the `[locale]` segment, so React re-rendered the layout
 * and reconciled the attribute back to its server value, discarding the
 * reader's choice.
 *
 * The attribute now belongs to the inline script and the toggle. React never
 * renders it, so React never resets it. This test reads the source because the
 * bug is a property of what is rendered, not of what any component returns.
 */

const layout = readFileSync(
  path.join(process.cwd(), "src/app/[locale]/layout.tsx"),
  "utf8",
);

/** The <html …> opening tag, which is the only part that matters here. */
function htmlTag(source: string): string {
  const start = source.indexOf("<html");
  expect(start, "the locale layout should render an <html> element").toBeGreaterThan(-1);
  return source.slice(start, source.indexOf(">", start) + 1);
}

describe("the theme", () => {
  it("is not rendered as an attribute on <html>", () => {
    const tag = htmlTag(layout);
    /* Comments in the tag mention the attribute on purpose; what must not be
       there is an actual JSX prop. */
    const withoutComments = tag.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments).not.toMatch(/\bdata-theme\s*=/);
  });

  it("is applied before first paint by an inline script", () => {
    /* Without this the correct theme would arrive a frame late and flash. */
    expect(layout).toMatch(/localStorage\.getItem\("ahd-theme"\)/);
    expect(layout).toMatch(/setAttribute\("data-theme"/);
  });

  it("suppresses the hydration warning the script necessarily causes", () => {
    expect(htmlTag(layout)).toMatch(/suppressHydrationWarning/);
  });

  it("falls back to the system preference rather than to a fixed theme", () => {
    expect(layout).toMatch(/prefers-color-scheme/);
  });

  it("has a stylesheet that renders correctly while the attribute is absent", () => {
    /* Between the server render and the inline script there is no attribute at
       all. That is safe here because the palette is dark-first by design — bare
       :root *is* the dark theme, and the lighter ones are opt-in. If that were
       ever inverted, the absent attribute would flash light before the script
       ran, so the two facts have to stay tied together. */
    const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/:root\[data-theme="light"\]/);
    expect(css).toMatch(/:root\[data-theme="sepia"\]/);
    expect(css).not.toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--surface-base/);
  });
});
