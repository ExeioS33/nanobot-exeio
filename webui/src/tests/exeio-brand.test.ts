import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { brandText } from "@/brand/exeio-brand";

const REPO_ROOT = resolve(__dirname, "../../..");

function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    out.push(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node as Record<string, unknown>)) {
      collectStrings(value, out);
    }
  }
}

/** Every translated string shipped by the app, app-level and per-channel. */
function localeCorpus(): string[] {
  const files: string[] = [];

  const appLocales = join(REPO_ROOT, "webui/src/i18n/locales");
  for (const locale of readdirSync(appLocales)) {
    files.push(join(appLocales, locale, "common.json"));
  }

  const channels = join(REPO_ROOT, "nanobot/channels");
  for (const channel of readdirSync(channels)) {
    const dir = join(channels, channel, "webui/locales");
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue; // channel ships no webui bundle
    }
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".json")) files.push(join(dir, file));
    }
  }

  const strings: string[] = [];
  for (const file of files) {
    collectStrings(JSON.parse(readFileSync(file, "utf8")), strings);
  }
  return strings;
}

describe("brandText", () => {
  it("rebrands prose", () => {
    expect(brandText("Connecting to nanobot…")).toBe("Connecting to Exeio…");
    expect(brandText("Restart nanobot to apply runtime changes.")).toBe(
      "Restart Exeio to apply runtime changes.",
    );
    expect(brandText("{{title}} · nanobot")).toBe("{{title}} · Exeio");
  });

  it("leaves untouched strings alone", () => {
    expect(brandText("Settings")).toBe("Settings");
  });

  // Each case below is a real string from upstream's locale bundles. Rebranding
  // any of them would print a broken identifier or a command that does not exist.
  it("preserves technical identifiers", () => {
    expect(brandText("@nanobot:matrix.org")).toBe("@nanobot:matrix.org");
    expect(brandText("Make sure the gateway is running (`nanobot gateway`).")).toBe(
      "Make sure the gateway is running (`nanobot gateway`).",
    );
    expect(brandText("Restart nanobot gateway and try again.")).toBe(
      "Restart nanobot gateway and try again.",
    );
    expect(brandText("Start nanobot with the webui command.")).toBe(
      "Start nanobot with the webui command.",
    );
    expect(brandText("Config lives in ~/.nanobot/config.json")).toBe(
      "Config lives in ~/.nanobot/config.json",
    );
    expect(brandText("Run nanobot-gateway now")).toBe("Run nanobot-gateway now");
  });

  it("does not touch identifier-shaped keys", () => {
    expect(brandText("nanobotFeatures")).toBe("nanobotFeatures");
  });

  it("elides the French particle before the vowel-initial brand", () => {
    expect(brandText("Chargement de nanobot…", "fr")).toBe("Chargement d’Exeio…");
    // "à" does not elide, and other locales keep their own grammar.
    expect(brandText("Connexion à nanobot…", "fr")).toBe("Connexion à Exeio…");
    expect(brandText("Chargement de nanobot…", "es")).toBe("Chargement de Exeio…");
  });

  it("rebrands a mixed string on the prose side only", () => {
    expect(brandText("Restart nanobot gateway, then reopen nanobot.")).toBe(
      "Restart nanobot gateway, then reopen Exeio.",
    );
  });
});

describe("locale corpus", () => {
  /**
   * The safety net for upstream drift. Rather than pinning every string that
   * mentions nanobot (which would fail on harmless prose edits), this asserts
   * the substitution never produces an IDENTIFIER-shaped "Exeio" — the failure
   * mode that actually breaks things. A new upstream identifier that the guards
   * in PROTECTED_PATTERNS don't recognise trips this immediately.
   */
  it("never rebrands nanobot into an identifier position", () => {
    const corrupted = /@Exeio[:.]|Exeio[-_]\w|[~/]\S*Exeio|`[^`]*Exeio/;
    const offenders = localeCorpus()
      .map((value) => brandText(value))
      .filter((value) => corrupted.test(value));

    expect(offenders).toEqual([]);
  });

  it("still rebrands the corpus (guards are not swallowing everything)", () => {
    const rebranded = localeCorpus().filter(
      (value) => brandText(value) !== value,
    );
    expect(rebranded.length).toBeGreaterThan(50);
  });
});
