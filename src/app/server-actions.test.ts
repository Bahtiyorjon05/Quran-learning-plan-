import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A "use server" file may only export async functions.
 *
 * Next enforces this when the module is loaded to handle an action POST, and
 * the failure is unusually cruel: every page renders perfectly, typecheck
 * passes, the build succeeds — and then the very first real form submission
 * dies with
 *
 *   A "use server" file can only export async functions, found object.
 *
 * which reaches the user as an opaque digest. Exactly that shipped: the shared
 * `IDLE` form state was exported from the actions file, so sign-up worked in
 * every test that called the service directly and broke for the first person
 * who actually pressed the button.
 *
 * This walks the source instead of trusting anyone to remember.
 */

const SRC = path.join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const serverActionFiles = walk(SRC).filter((file) => {
  const source = readFileSync(file, "utf8").trimStart();
  return source.startsWith('"use server"') || source.startsWith("'use server'");
});

describe('"use server" modules', () => {
  it("exist, so this test is actually guarding something", () => {
    expect(serverActionFiles.length).toBeGreaterThan(0);
  });

  it.each(serverActionFiles.map((f) => path.relative(process.cwd(), f)))(
    "%s exports only async functions",
    (relative) => {
      const source = readFileSync(path.join(process.cwd(), relative), "utf8");

      /* `export const x = …`, `export let`, `export var` — anything that is not
         a function declaration. Arrow functions assigned to a const are still
         rejected by Next unless async, and are worth flagging either way. */
      const valueExports = [...source.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)].map(
        (m) => m[1],
      );
      expect(valueExports, `${relative} exports values, not just functions`).toEqual([]);

      /* Type-only exports are erased at compile time and are fine; a plain
         `export { Something }` of a runtime value is not. */
      const reExports = [...source.matchAll(/^export\s+\{([^}]*)\}/gm)]
        .filter((m) => !/^\s*type\s/.test(m[1]))
        .map((m) => m[1].trim());
      expect(reExports, `${relative} re-exports runtime values`).toEqual([]);

      /* Every exported function must be async: Next requires it, and a sync
         one fails the same way at the same unhelpful moment. */
      const syncFunctions = [
        ...source.matchAll(/^export\s+(?!async\s)(?:default\s+)?function\s+(\w+)/gm),
      ].map((m) => m[1]);
      expect(syncFunctions, `${relative} exports non-async functions`).toEqual([]);
    },
  );
});
