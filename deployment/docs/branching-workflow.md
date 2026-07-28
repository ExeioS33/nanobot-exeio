# Branching & upstream-sync workflow

How this fork stays current with [`HKUDS/nanobot`](https://github.com/HKUDS/nanobot)
while keeping Exeio's own branding and deployment tooling intact. This is a
process document, not a code doc — see `deployment/ansible/README.md` for the
IaC itself.

## Why two long-lived branches

A single `main` used to carry both upstream's code *and* Exeio's rebrand,
which meant every upstream sync had to special-case and protect the branded
files. That coupling is gone now:

- **`main`** — a near-pure mirror of upstream `HKUDS/nanobot`. No rebrand, no
  ansible, nothing Exeio-specific beyond the sync automation itself. This is
  what makes syncing upstream low-friction: merges rarely conflict, because
  `main` never diverges from upstream's shape.
- **`dev`** — the actual Exeio product: `main`'s history plus the rebrand
  (`webui/**`, `nanobot/channels/*/webui/**`) and this `deployment/` directory.
  Feature branches (new features, more rebrand work, more infra) branch from
  and PR into `dev`, never `main` directly.

## The two automated workflows

### 1. `sync-upstream.yml` — upstream → `main`

- Runs weekly (Monday 06:00 UTC) plus on-demand via `workflow_dispatch`.
- Fetches `HKUDS/nanobot`'s `main`, merges it into a `sync/upstream-<date>`
  branch, and opens a PR back into this fork's `main`.
- Diff is categorized `docs-only` vs `core`. `docs-only` PRs auto-merge
  immediately (label `sync-upstream`, safe by construction — `docs/**` can't
  break anything). `core` PRs need CI green + a manual merge click.
- If the merge itself conflicted, the PR body says so and points at the sync
  branch to resolve on.

### 2. `sync-main-to-dev.yml` — `main` → `dev`

- Triggers on every push to `main` (i.e. right after a sync PR from step 1
  lands), plus `workflow_dispatch`.
- Merges `main` into a `sync/main-to-dev-<date>` branch, then hard-restores
  `webui/**`, `deployment/**`, and `nanobot/channels/*/webui/**` to `dev`'s
  own version — regardless of what the merge did to them. This is the same
  merge-then-restore technique `sync-upstream.yml` used to run directly
  against `main`, just moved one layer up to where the branded/deployment
  content now actually lives.
- Opens a PR into `dev`, same `docs-only`/`core` auto-merge tiering, labeled
  `sync-main-to-dev`.
- Flags two things loudly rather than merging silently:
  - **New channel with no local webui counterpart**: upstream added
    `nanobot/channels/<x>/` with a `webui/` bundle that `dev` has never seen.
    It comes through un-rebranded because there was nothing local to restore
    it to — forces manual review even on an otherwise docs-only diff, and
    needs a one-time rebrand pass before it's safe to merge.
  - **Merge conflicts outside the excluded paths**: almost always means
    upstream and `dev` both touched the *same* file inside a normally-excluded
    path (e.g. upstream changed `webui/index.html`'s `<title>`, which Exeio
    also rebranded). Resolve by hand on the sync branch — keep Exeio's
    branding/content, fold in whatever upstream's underlying change was.

## The steady-state loop

1. `sync-upstream.yml` fires weekly → PR into `main`. Docs auto-merge; core
   needs your review.
2. Merging that PR pushes to `main`, which immediately triggers
   `sync-main-to-dev.yml` → PR into `dev`. Same tiering, plus the two flags
   above.
3. Review/merge into `dev`.

Do this promptly after each `main` update rather than letting several
upstream syncs pile up unmerged into `dev` — a `dev` that's one sync behind
`main` has a small, easy-to-review diff; several syncs behind means a much
larger merge with more surface for the webui-overlap conflict case above.

## What's genuinely excluded from upstream sync, forever

`webui/**`, `nanobot/channels/*/webui/**`, and `deployment/**` are Exeio-owned
and never silently overwritten by an upstream change. Real upstream fixes to
those areas (e.g. a webui bug fix, a security patch) do **not** flow through
automatically — they only surface as the "merge conflict on an excluded
path" case above, and only if they touch the exact same lines Exeio also
changed. Anything else upstream does there is invisible to `dev`. This is a
known tradeoff: near-zero manual sync burden today, at the cost of having to
notice and manually backport anything upstream fixes in those files. Revisit
if the webui/channel-webui divergence grows large enough that this stops
being the right default.

## Deploying

The ansible role's `nanobot_repo_ref` (`deployment/ansible/group_vars/all/vars.yml`)
points at `dev` — that's the branch with the actual product on it (rebrand +
this `deployment/` tree). `main` alone is not deployable; it has no branding
and no ansible tooling.
