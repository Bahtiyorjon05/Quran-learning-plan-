import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The theme must survive a language switch.
 *
 * Choosing English threw a light-theme reader into the dark. Removing
 * `data-theme="dark"` from the server render was the obvious fix and it was not
 * enough: watching a real browser showed React *removing* the attribute on the
 * client re-render — the locale is a segment of the root layout, so switching
 * language re-renders <html>, and React drops attributes it does not own.
 *
 * So the arrangement has three parts, and all three have to stay: the attribute
 * is not rendered, an inline script sets it before first paint, and ThemeGuard
 * puts it back when React takes it away.
 *
 * These read the source, because the bug is a property of what is rendered
 * rather than of what any component returns. The behaviour itself is covered by
 * scripts/observe-theme.ts, which drives a real browser through every language,
 * theme and device preference — this file cannot catch a React reconciliation.
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

  it("mounts the guard that restores it after a locale re-render", () => {
    /* Without this, React removes the attribute when the language changes and
       nothing puts it back — the reader stays in the wrong theme until they
       reload. Verified against a real browser in scripts/observe-theme.ts. */
    expect(layout).toMatch(/<ThemeGuard\s*\/>/);
    expect(layout).toMatch(/from "@\/components\/site\/theme-guard"/);

    const guard = readFileSync(
      path.join(process.cwd(), "src/components/site/theme-guard.tsx"),
      "utf8",
    );
    /* Before paint, or the restored theme arrives a frame late and flashes. */
    expect(guard).toMatch(/useLayoutEffect/);
    expect(guard).toMatch(/MutationObserver/);
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
