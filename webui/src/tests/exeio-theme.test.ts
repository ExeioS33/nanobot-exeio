import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const themeCss = readFileSync(resolve(__dirname, "../brand/exeio-theme.css"), "utf8");
const globalsCss = readFileSync(resolve(__dirname, "../globals.css"), "utf8");

function customProperties(css: string): string[] {
  return [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]);
}

describe("exeio-theme.css", () => {
  /**
   * The override only works because it reuses upstream's token NAMES. If
   * upstream renames one, the override silently stops applying to it and that
   * part of the UI quietly reverts to nanobot's palette with no error anywhere.
   * globals.css changes ~twice a week upstream, so this is a live risk.
   */
  it("only overrides tokens that still exist upstream", () => {
    const upstream = new Set(customProperties(globalsCss));
    const orphaned = [...new Set(customProperties(themeCss))].filter(
      (token) => !upstream.has(token),
    );

    expect(orphaned).toEqual([]);
  });

  it("overrides both light and dark token blocks", () => {
    expect(themeCss).toMatch(/^:root\s*\{/m);
    expect(themeCss).toMatch(/^\.dark\s*\{/m);
  });

  /**
   * Cascade layers: unlayered declarations outrank layered ones. globals.css
   * defines its tokens inside `@layer base`, so this file must stay unlayered
   * for the override to win without !important.
   */
  it("stays unlayered so it outranks globals.css @layer base", () => {
    const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripComments(globalsCss)).toMatch(/@layer\s+base/);
    expect(stripComments(themeCss)).not.toMatch(/@layer/);
  });
});
