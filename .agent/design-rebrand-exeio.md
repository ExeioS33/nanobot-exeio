# WebUI Rebranding Design — nanobot → Exeio Corp.

**Status:** Design / not yet implemented
**Scope:** `webui/` presentation layer only. No gateway, protocol, CLI, or Python API changes.

---

## 1. Source of Truth: The Official Logo

Downloaded from `https://github.com/ExeioS33/exeio/blob/main/exeio_corp_official_logo.png`
(raw: `raw.githubusercontent.com/ExeioS33/exeio/main/exeio_corp_official_logo.png`).

| Property | Value |
|---|---|
| Dimensions | 1536 × 1024 px, 8-bit RGB, **no alpha** |
| Composition | Horizontal wordmark, centred, ~55% of frame width |
| Lettering | Ornate blackletter / gothic — `exeio` over a rule-flanked `corp.` |
| Treatment | Polished emerald chrome with specular star glints and additive bloom |
| Background | Solid near-black `#010101` (baked in, not transparent) |

### Extracted palette (measured, not guessed)

| Role | Hex | HSL | Where it comes from |
|---|---|---|---|
| Signature emerald | `#3DCC8B` | `153 70% 80%` (v) | Mean of 27.4k vivid mid-tone pixels |
| Specular highlight | `#CBFBE1` | `148 19% 98%` | Mean of the 2k brightest pixels |
| Deep shadow / bevel | `#014B29` | `152 99% 29%` | Dominant dark-green cluster |
| Field | `#010101` | `0 0% 0%` | 45% of all pixels |

**Brand hue is 152–153.** This is the anchor for every token below.

---

## 2. Current State (uncommitted work already on disk)

A prior pass partially applied a rebrand. It is *directionally* right but has four gaps.

**Already done**
- `webui/src/globals.css` — light + dark tokens retinted from neutral grey to emerald; goal-halo keyframes recoloured from sky-blue to emerald.
- `webui/index.html` — favicon/apple-touch links repointed; dark `theme-color` → `#0a0f0d`; splash background → `#131d18`.
- `webui/src/components/Sidebar.tsx` — mark `src` repointed.
- Assets: `exeio_{mark.svg,favicon_32.png,apple_touch.png}` added; six `nanobot_*` files deleted.
- `nanobot/web/dist/` already rebuilt against the above.

**Verified safe:** no dangling references to the six deleted `nanobot_*` assets anywhere in `webui/src`, `index.html`, `docs/`, or `README.md`.

### Gap 1 — the mark is a placeholder, unrelated to the logo (critical)

`webui/public/brand/exeio_mark.svg` is a hand-authored generic **gem/diamond** with a sparkle. It shares the emerald colour family with the real logo and nothing else — no blackletter, no letterform, no connection to `exeio`. The favicon and apple-touch PNGs derive from this same placeholder. This is the single biggest correctness gap: the app currently ships a mark that is not the brand.

### Gap 2 — hue drift

Applied CSS uses hue **158–160** for primary/ring/accent; the logo measures **152–153**. Small but visible as a teal-ward shift away from the wordmark's emerald.

### Gap 3 — strings untouched

~350 `nanobot` occurrences across 10 locale files (34–36 each), plus `<title>nanobot</title>` in `index.html`. Brand key is still `"app.brand": "nanobot"`.

### Gap 4 — no wordmark asset

The full logo has no home. `nanobot_logo.png` / `.webp` were deleted with no Exeio equivalent.

---

## 3. Asset Architecture

The logo is a **wide raster wordmark with a baked black background**. Three distinct surfaces need three derived assets — a single file cannot serve all of them.

```
webui/public/brand/
├── exeio_mark.svg          16–32px square monogram   sidebar (h-8 w-8), favicon
├── exeio_favicon_32.png    32×32 raster fallback     <link alternate icon>
├── exeio_apple_touch.png   180×180 rounded tile      iOS home screen
├── exeio_wordmark.svg      wide lockup, currentColor boot splash, login, about
└── exeio_logo.png          full-fidelity original    docs, README, social preview
```

### 3.1 The square mark — derive a monogram, do not scale the wordmark

Scaling a 1536×1024 wordmark into a 32×32 box renders `exeio corp.` illegible mush. The mark must be a **lettermark built from the logo's own `e`**.

Recommended construction:
1. Crop the leading `e` glyph from the source PNG at full resolution.
2. Vector-trace its blackletter silhouette (the distinctive spurred, angular `e`).
3. Rebuild as clean SVG paths — a linear gradient `#CBFBE1 → #3DCC8B → #014B29` along the bevel axis, matching the chrome's light direction.
4. Seat it on a `rx=22` rounded-square field in `#0A0F0D`, consistent with the current mark's container geometry (keeps the existing sidebar/tile fit).

This preserves the two things that actually read at 32px — **the blackletter silhouette** and **the emerald chrome ramp** — and discards the glow and glints, which turn to noise below ~64px.

### 3.2 The black-background problem (light mode)

The bloom in the source is *additive on black*. Naïve background removal leaves a dark halo on light surfaces.

- **Dark mode** — extract alpha from luminance (`α ≈ L`). Additive glow composites correctly this way and the bloom is preserved.
- **Light mode** — the glow cannot be kept. Ship a **flat variant**: solid `#0B7A4E` letterforms, no bloom, no glints. Deeper than the signature emerald so it clears WCAG AA on white.

Select between them with `<picture>` + `prefers-color-scheme`, or a `currentColor` SVG where the letterforms are single-tone.

### 3.3 Wordmark placement

The sidebar header (`Sidebar.tsx:116-121`) has **no wordmark slot** — only an 8×8 square button, and the expanded state adds a collapse control, not a logotype. Adding a wordmark there is a layout change, not a swap. Recommend limiting the wordmark to the **boot splash** and **auth screen**, where there is room and where brand impression matters most.

---

## 4. Design Tokens

Correct the hue drift in `webui/src/globals.css` from 158–160 to the measured **152–153**.

### Light (`:root`)

| Token | Value | Rationale |
|---|---|---|
| `--primary` | `153 84% 24%` | Darkened signature emerald; AA on white |
| `--primary-foreground` | `0 0% 100%` | |
| `--ring` | `153 75% 32%` | |
| `--accent` | `152 45% 92%` | Tint of the same hue |
| `--accent-foreground` | `153 60% 16%` | |
| `--sidebar` | `152 22% 96.5%` | |
| `--border` / `--input` | `150 14% 89%` | |

### Dark (`.dark`)

| Token | Value | Rationale |
|---|---|---|
| `--background` | `158 14% 9%` | Near-black field, echoes `#010101` without crushing |
| `--card` | `158 12% 13%` | |
| `--primary` | `153 70% 50%` | The signature `#3DCC8B` itself |
| `--primary-foreground` | `158 40% 7%` | |
| `--ring` | `153 70% 52%` | |
| `--accent` | `155 25% 20%` | |
| `--sidebar` | `158 16% 7%` | Darkest surface — frames the mark like the logo's field |

**Contrast gate:** every foreground/background pair must be verified at **AA (4.5:1)** in both schemes before merge. The dark-mode `--primary` at 50% lightness on a 9% background passes comfortably; the light-mode primary at 24% is the one to re-check after any adjustment.

### Glow accents

The logo's specular bloom is a genuine brand signature and justifies the existing `goal-shell-glow` treatment. Keep it, but re-anchor to hue 152–153 (currently 152–158, close — minor correction only).

---

## 5. String Strategy

The critical rule: **`nanobot` is three different things in this codebase.** Only one may be renamed.

| Class | Examples | Action |
|---|---|---|
| **Product name (user-visible)** | `app.brand`, `documentTitle.base`, `"Connecting to nanobot…"`, `<title>` | **Rename → Exeio** |
| **CLI commands** | `` `nanobot gateway` `` in `app.error.gatewayHint`, `nanobot trigger`, `nanobot plugins` | **Keep verbatim** — the binary is still `nanobot`; renaming makes the hint wrong |
| **Internal identifiers** | `nanobot-client.ts`, `useNanobotStream`, `NANOBOT_API_URL`, `nanobot/web/dist` | **Keep** — out of scope, high churn, zero user benefit |

### Two traps

1. **`localStorage` key `"nanobot-webui.theme"`** (`index.html:~88`). Renaming it silently resets every existing user's theme preference on next load. **Do not rename**, or ship a read-old/write-new migration. This is easy to sweep up accidentally in a global find-and-replace.

2. **`brand.color` / `brand.initials` is a false positive.** In `ModelPresetBadge.tsx:384-410` and `SettingsView.tsx:9232-9516` these refer to **LLM provider** branding (OpenAI, Anthropic, …), not app branding. Do not touch.

### Naming decision required

The logo reads `exeio corp.` The product name should be **`Exeio`** — `corp.` is a corporate suffix, not a product name, and would read oddly in `"Connecting to exeio corp.…"`. Capitalisation: the logo is lowercase, but sentence-position strings (`"Restart Exeio"`) read better capitalised. **Recommend `Exeio`**, with the lowercase form reserved for the logo lockup itself.

### Locale handling

Translate the 10 locale files consistently. In CJK locales the brand token sits inline (`重新啟動 nanobot`) — substitution is mechanical, but `zh-TW` and `pt-BR` carry 36 occurrences vs 34 elsewhere, so verify counts per file rather than assuming uniformity.

---

## 6. Implementation Sequence

| # | Step | Files | Risk |
|---|---|---|---|
| 1 | Build the monogram from the logo's `e`; regenerate favicon + apple-touch from it | `public/brand/*` | Med — design judgement |
| 2 | Derive wordmark SVG (dark + flat light variants) | `public/brand/exeio_wordmark*.svg` | Med — alpha extraction |
| 3 | Correct token hue 158→153; verify AA both schemes | `src/globals.css` | Low |
| 4 | Rename user-visible strings; **preserve** CLI refs + storage key | `index.html`, `src/i18n/locales/*/common.json` | Med — trap-prone |
| 5 | Place wordmark on boot splash + auth screen | `index.html`, auth component | Low |
| 6 | `bun run test` + `bun run build` | — | Low |
| 7 | Visual QA: light/dark, sidebar collapsed/expanded, favicon at 16px, iOS tile | — | Low |

Steps 1–2 gate everything else; 3 and 4 are independent and can run in parallel.

---

## 7. Non-Goals

- Renaming the Python package, CLI binary, config path (`~/.nanobot/`), or WebSocket protocol.
- Rebranding `docs/`, root `README.md`, or `webui/README.md` (upstream-facing; separate decision).
- Restyling components beyond token-level colour changes.
- Changing the `nanobot/web/dist/` output path.

---

## 8. Open Questions

1. **Product name** — confirm `Exeio` over `exeio` / `Exeio Corp.`
2. **Upstream docs** — rebrand `README.md` and `docs/`, or keep this a WebUI-only fork skin?
3. **Attribution** — retain a "built on nanobot" credit? Relevant to the upstream licence and to `webui/README.md`'s existing acknowledgements section.
4. **Light-mode logo** — approve the flat non-glow variant, or restrict the wordmark to dark surfaces only?
