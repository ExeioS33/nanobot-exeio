/**
 * Exeio brand substitution for user-facing copy.
 *
 * This fork tracks upstream HKUDS/nanobot closely. Rather than editing ~170
 * locale files in place (which made every upstream locale change a merge
 * conflict, and meant every new upstream string arrived un-rebranded), the
 * substitution happens at render time as an i18next post-processor.
 *
 * The hard part is NOT the substitution — it's knowing where "nanobot" is a
 * brand name (rebrand it) versus a technical identifier that must survive
 * verbatim (leave it alone). Getting that wrong ships broken instructions:
 * upstream really does have strings like "@nanobot:matrix.org" and
 * "Restart nanobot gateway and try again".
 *
 * So substitution is guarded: anything matching PROTECTED_PATTERNS is passed
 * through untouched, and exeio-brand.test.ts pins the behaviour against the
 * full upstream locale corpus so a new upstream identifier fails a test rather
 * than silently corrupting a user-facing string.
 */

export const BRAND_NAME = "Exeio";
export const UPSTREAM_NAME = "nanobot";

/**
 * Segments where "nanobot" is a technical identifier, not a brand name.
 * Each entry cites the upstream string that motivated it — if you add one,
 * add the real string too, so the next person can tell intent from guesswork.
 */
export const PROTECTED_PATTERNS: readonly RegExp[] = [
  // "@nanobot:matrix.org" — a Matrix user ID shown as setup instructions.
  /@nanobot:[\w.-]+/g,
  // "…running (`nanobot gateway`)…" — anything fenced in backticks is code.
  /`[^`]*`/g,
  // "Restart nanobot gateway and try again." — CLI invocation, unfenced.
  /nanobot gateway/gi,
  // "Start nanobot with the webui command." — CLI binary named in prose.
  /nanobot with the webui/gi,
  // Hyphen/underscore identifiers: nanobot-gateway, nanobot_config, …
  /nanobot[-_][\w-]+/gi,
  // Filesystem paths: ~/.nanobot, ./nanobot/, /opt/nanobot
  /[~./][\w/.]*nanobot[\w/.]*/gi,
];

const PROTECTED = new RegExp(PROTECTED_PATTERNS.map((r) => r.source).join("|"), "gi");

// Word-bounded so identifiers like "nanobotFeatures" are never touched.
const BRAND = /\bnanobot\b/gi;

/**
 * "Exeio" begins with a vowel, so French elides the preceding particle:
 * upstream's "Chargement de nanobot…" must become "Chargement d’Exeio…",
 * not "de Exeio". Upstream's own copy uses the typographic apostrophe.
 */
function applyFrenchElision(value: string): string {
  return value.replace(/\bde (?=Exeio\b)/g, "d’").replace(/\bDe (?=Exeio\b)/g, "D’");
}

/**
 * Rebrand a single user-facing string, leaving protected identifiers intact.
 * Safe to call on any string; returns the input unchanged when there's nothing
 * to do (the common case, so it stays cheap).
 *
 * `locale` enables language-specific grammar fixes; omit it for locale-agnostic
 * substitution.
 */
export function brandText(value: string, locale?: string): string {
  if (typeof value !== "string" || !BRAND.test(value)) {
    BRAND.lastIndex = 0;
    return value;
  }
  BRAND.lastIndex = 0;

  let out = "";
  let cursor = 0;
  for (const match of value.matchAll(PROTECTED)) {
    const start = match.index ?? 0;
    out += value.slice(cursor, start).replace(BRAND, BRAND_NAME);
    out += match[0]; // protected — verbatim
    cursor = start + match[0].length;
  }
  const branded = out + value.slice(cursor).replace(BRAND, BRAND_NAME);

  return locale?.startsWith("fr") ? applyFrenchElision(branded) : branded;
}

/**
 * i18next post-processor. Registered globally in i18n/index.ts, so it applies
 * to every namespace — including the per-channel locale bundles and any new
 * locale upstream adds later, with no further wiring.
 */
export const exeioBrandPostProcessor = {
  type: "postProcessor" as const,
  name: "exeioBrand",
  process(value: string, _key: string, options: { lng?: string }): string {
    return brandText(value, options?.lng);
  },
};
