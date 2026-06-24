# Landing Page — Design

**Date:** 2026-06-24
**Status:** Approved (design); pending spec review

## Problem

The root URL (`/`) currently redirects straight to `/create` (`src/app/page.tsx` does `redirect("/create")`). For **cold public visitors** — people arriving from a shared link, a post, or search — this drops a stranger onto a form asking for a repository URL with no explanation of what the tool produces.

Commit Animation is a "you have to see it to get it" product: describing "a line-level diff morph" in words sells it poorly, and `PRODUCT.md` explicitly bans the generic AI-SaaS landing scaffold (hero-metric blocks, tracked-uppercase eyebrows, identical card grids). So the goal is a landing page that **demonstrates the product rather than describing it**, while staying inside the existing brand and design guardrails.

## Goals

- Give first-time visitors an immediate, wordless understanding of what the tool does.
- Stay on-brand: calm, content-first, one ember accent, no marketing scaffold, nothing larger than ~22px (the No-Hero rule).
- Reuse the existing player to do the explaining; build as little new UI as possible.
- Degrade gracefully on a fresh self-hosted install (no demo data, no crash).
- Leave the `/create` utility flow completely untouched.

## Non-Goals

- No marketing sections, feature grids, FAQ, or examples gallery.
- No DB seeding mechanism or demo-data migration.
- No changes to extraction, storage, or the `/create` and `/a/<id>` flows.
- No SEO/social-preview work (can be a later, separate effort).

## Chosen Approach: "Show, don't tell"

Replace the root redirect with a single calm screen that autoplays a curated example morph and offers one call to action. The product sells itself in the first seconds; the chrome stays quiet.

Rejected alternatives:

- **Text-only intro (headline + sentence + CTA, no demo):** cheapest, but commits the exact sin the product warns against — describing motion in prose — and wastes the strongest asset (the morph). Kept only as the *fallback* layout when no demo is available.
- **Full marketing page (hero + feature sections + gallery + FAQ):** directly violates the `PRODUCT.md` anti-references, most work, overkill for the product's stage. Rejected.

## Architecture

### Routing

- `src/app/page.tsx` becomes a real landing page (server component) instead of `redirect("/create")`.
- `/create` is unchanged. The landing's primary CTA links to `/create`.
- `/a/<id>` is unchanged.

### Configuration

- New constant `LANDING_EXAMPLE_IDS: string[]` in `src/lib/constants.ts`.
- Sourced from a `LANDING_EXAMPLE_IDS` env var, comma-separated. Parsing: split on `,`, trim each, drop empties. Unset/empty → `[]`.
- These are the pinned `/a/<id>` ids of curated animations to showcase, in priority order.

### Demo sourcing + fallback

The `/` server component resolves the demo at request time:

1. Read `LANDING_EXAMPLE_IDS`.
2. For each id in order, call the existing `findAnimation(id)` (from `src/lib/store/animations.ts`) and take the **first one that exists**.
3. Render:
   - **Demo found** → headline + subhead, an autoplaying `Player` for that payload, and the CTA.
   - **No id resolves** (empty list, or none of the pinned ids exist — e.g. a fresh install or wiped DB) → headline + subhead + CTA **without** the demo. No broken player, no crash.

This keeps a fresh self-hosted instance showing a clean landing page; the curated demo appears only once a real id is pinned. No DB seeding required.

### Page composition

One screen, top to bottom — no scroll-marketing:

- Short headline + one-sentence subhead — the only prose, quiet, ≤22px (No-Hero rule).
- The live demo: a reused `Player` (or a thin read-only wrapper of it) autoplaying the resolved example morph.
- A single primary "Animate a file →" link/button to `/create` — the one ember accent on the screen.
- Optional tiny muted footer line. No feature grid, no eyebrows, no metrics.

The landing is **composition over new UI**: it reuses `Player`/`CodeViewport` to display the morph rather than introducing a new display component.

## Motion & Accessibility

- The demo autoplays on load but honors `prefers-reduced-motion` exactly as the player already does: reduced motion shows the final/instant state with no anticipation beat or auto-scroll.
- The CTA is a real labeled link/button carrying the global `:focus-visible` ember ring.
- Contrast holds to the AA floor defined in `DESIGN.md` (body/muted ≥4.5:1).
- Change cues remain conveyed by motion + position, not color alone (inherited from the player).

## Testing

- **Unit / RTL** (`tests/components` or a landing test):
  - Renders headline + CTA.
  - Renders the demo `Player` when a pinned id resolves.
  - Omits the demo (and does not crash) when no id resolves.
- **Constants** (`tests/lib/constants.test.ts`):
  - `LANDING_EXAMPLE_IDS` parses the env var: comma-split, trimmed, empties dropped, unset → `[]`.
- **E2E** (Playwright, `tests/e2e`):
  - Visiting `/` shows the landing and its CTA.
  - The CTA navigates to `/create`.
  - `/create` still works (regression guard for the removed redirect).

## Risks / Notes

- Pinned ids depend on DB rows existing; the fallback covers their absence so the page never breaks.
- Autoplaying a `Player` on the server-rendered root must not regress initial load — the player is already client-side; the landing just mounts it. Watch for the `better-sqlite3` deferred-require pattern already in `src/lib/store/db.ts` (the root page reads the DB at request time, like `/a/<id>` does).
