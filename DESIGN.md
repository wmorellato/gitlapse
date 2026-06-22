---
name: Commit Animation
description: Watch a file evolve across its git history — a calm, share-worthy diff morph.
colors:
  ember: "#c2410c"
  bg: "#f7f8fa"
  surface: "#ffffff"
  ink: "#1c2024"
  muted: "#6b7280"
  border: "#e5e7eb"
  add-wash: "#22c55e24"
  remove-wash: "#f43f5e1f"
  on-ember: "#ffffff"
  danger: "#b00020"
typography:
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  code:
    fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
rounded:
  sm: "6px"
  md: "10px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s6: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.on-ember}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  button-primary-disabled:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.on-ember}"
  control-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    width: "36px"
  input-field:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "24px"
---

# Design System: Commit Animation

## 1. Overview

**Creative North Star: "The Replay"**

The interface is a quiet theater built around one performance: a file rewriting itself, commit by commit. Everything that isn't the content is seating — present, comfortable, and deliberately unremarkable. The body sits on a cool near-white (`#f7f8fa`); content lives on a single white card with a hairline border and one soft ambient shadow. The eye is pulled to the playback, never to the chrome. When a change is about to happen, the affected lines glow in a soft wash for a beat, then added lines grow in and removed lines collapse out while everything else glides to its new place. That anticipation-then-resolution is the delight, and it comes entirely from craft, not decoration.

This system explicitly rejects the cold, faceless enterprise dashboard and the generic AI-SaaS landing template (cream backgrounds, tracked-uppercase eyebrows, hero-metric blocks, endless identical card grids). It also rejects flashy motion — no bounce, no elastic, no effect that doesn't clarify what changed. Warmth comes from a single ember-orange accent and generous reading typography, not from gradients or glass.

**Key Characteristics:**
- Content-first: chrome recedes so the morph is the only thing that performs.
- One warm accent, used sparingly, on an otherwise neutral cool-white canvas.
- Flat by default; depth appears only on the one surface that holds content.
- Motion is semantic — it explains the diff, never just dresses it up.
- Reading comfort (wrapping, measure, contrast) outranks visual flourish.

## 2. Colors

A near-neutral cool palette with a single warm accent; the only saturated color on screen is reserved for action, and two soft washes carry add/remove meaning during the morph.

### Primary
- **Ember** (`#c2410c`, oklch ~0.53 0.16 41): The one warm, saturated voice. Used only for interactive intent — the primary "Animate" button fill (with white text), text links, the timeline's filled track, the focus-visible ring, and control-button hover borders. A deep burnt orange chosen so it clears WCAG AA both as white-on-ember (4.7:1, the button) and ember-on-white (4.7:1, links).

### Neutral
- **Canvas** (`#f7f8fa`): The body background — a cool near-white, chroma ~0. Also the fill of inset inputs.
- **Surface** (`#ffffff`): The content card (viewport, create form) that floats above the canvas.
- **Ink** (`#1c2024`): Primary text and icon color.
- **Muted** (`#6b7280`): Secondary text — line numbers, metadata (author, timestamp), labels, status lines, the `truncated` pill. Verified ≥4.5:1 on both canvas and surface.
- **Border** (`#e5e7eb`): Hairline borders, dividers, the unfilled timeline track. 1px only.

### Tertiary — Change Washes
- **Add Wash** (`#22c55e24` — green at ~14% alpha): Painted on a line in the *anticipate* beat when it is about to be added; relaxes to transparent once applied.
- **Remove Wash** (`#f43f5e1f` — rose at ~12% alpha): Painted on a line about to be removed; the line then collapses out.
- **Danger** (`#b00020`): Inline form error text only.

### Named Rules
**The One Voice Rule.** Ember is the only saturated color in the UI and appears on ≤10% of any screen. Its rarity is what makes "this is the action" unmistakable. Never use it as a background fill for large areas or as decoration.

**The Wash-Is-A-Verb Rule.** The green/rose washes are transient — they mark a line *about to change*, never a permanent state. They are always paired with motion (grow/collapse) and position, so meaning never depends on color alone.

## 3. Typography

**Display / Body Font:** system sans stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`)
**Code Font:** system mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, …`)

**Character:** Zero-latency, zero-cost native UI type — invisible, familiar, and crisp at every size. The deliberate move is *adaptive*: prose and markdown render in the proportional sans for reading comfort; code renders in the mono stack for column fidelity. One axis of contrast (proportional vs. monospaced), chosen by content, not decoration.

### Hierarchy
- **Title** (600, 22px, 1.3): The create-form heading ("Commit Animation"). The largest type in the app — there is no oversized hero.
- **Body** (400, 14px, 1.6): Prose/markdown content in the viewport; capped to a comfortable measure (`--measure: 72ch`).
- **Code** (400, 13px, 1.6): Monospace content in the viewport for code files.
- **Label** (400, 13px): Metadata and controls — author, timestamps, speed control, status text.
- **Muted meta** (400, 13px, `#6b7280`): The commit-info row and helper copy.

### Named Rules
**The Adaptive-Type Rule.** Content font is chosen by file type: markdown/plaintext → proportional sans (no line numbers); all code → monospace (with line numbers). Never force prose into monospace "because it's a code tool."

**The No-Hero Rule.** Nothing exceeds ~22px. This is a tool and a player, not a landing page; there is no display headline to shout with.

## 4. Elevation

Flat by default. Depth is rationed: the body is a matte cool-white, and structure is drawn with 1px hairline borders rather than shadow. Exactly one elevation token exists, and it lifts only the surfaces that hold content (the viewport card, the create card) a single, soft step off the canvas.

### Shadow Vocabulary
- **Ambient Card** (`box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)`): A soft, diffuse two-layer lift. Used on the content card only — never on buttons, inputs, or rows.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat and bordered at rest. The single ambient shadow exists to separate the content card from the canvas, not to decorate. If you're reaching for a second shadow value, use a border instead.

## 5. Components

Refined and restrained: hairline borders, a soft 10px radius, quiet surfaces, and motion only where it clarifies. Nothing shouts.

### Buttons
- **Shape:** Soft corners (10px radius, `{rounded.md}`).
- **Primary ("Animate"):** Ember fill (`#c2410c`) with white text (`#fff`), 600 weight, 42px tall, full-width in the create card. Disabled drops to 60% opacity with a default cursor.
- **Control icon buttons (prev / play-pause / next):** 36×36, white surface, 1px border; on hover the border becomes ember. Always carry an `aria-label`; the play/pause label reflects state.

### Inputs / Fields
- **Style:** Inset feel — canvas-colored fill (`#f7f8fa`) inside the white card, 1px border, 10px radius, 40px tall, stacked under a 13px label.
- **Focus:** The global 2px ember `:focus-visible` ring (offset 2px). No glow, no color-shift gimmick.
- **Error:** Inline message in danger red (`#b00020`) with `role="alert"`; the submit button re-enables on failure.

### Timeline (signature)
- A native `<input type="range">` (keyboard-operable for free): slim 6px track in border-gray, filled portion in ember, a clean circular thumb ringed in surface white with the ambient shadow. Full-width, comfortable hit area. Dragging it snaps the playback instantly (no morph beat); play/next/prev animate.

### Commit Info Bar
- A single quiet meta row above the viewport: short SHA in a monospace chip (bordered, 6px radius), the first line of the commit message (ellipsized), author and relative time in muted gray, and an `N / M` position. No card, no shadow.

### Code Viewport (signature)
- The performance surface. One row per line, wrapping (`pre-wrap` + `overflow-wrap: anywhere`) so full paragraphs and long lines stay visible with vertical scroll only. Line heights animate to `auto`. Code-only line-number gutter (muted, `user-select: none`, `aria-hidden`). During the *anticipate* phase the container carries `data-phase="anticipate"`; rows carry `data-type`, and CSS — not JS color interpolation — paints the add/remove washes, which fade via a 0.35s `background-color` transition. The first changed line scrolls to the top of the viewport as it highlights.

### Card / Container
- **Corners:** 10px radius. **Background:** surface white. **Shadow:** the single Ambient Card token. **Border:** 1px hairline. **Padding:** 24px (create card). Never nest cards.

## 6. Do's and Don'ts

### Do:
- **Do** keep Ember (`#c2410c`) for interaction only — buttons, links, the timeline fill, focus rings — on ≤10% of any screen (The One Voice Rule).
- **Do** choose the content font by file type: proportional sans for prose/markdown, monospace for code (The Adaptive-Type Rule).
- **Do** convey add/remove with motion and position as well as the washes, so color is never the only signal.
- **Do** keep body and muted text at AA: body/placeholder ≥4.5:1, large text ≥3:1. Muted gray (`#6b7280`) is the floor, not lighter.
- **Do** draw structure with 1px hairline borders; reserve the single ambient shadow for the content card (The Flat-By-Default Rule).
- **Do** give every animation a `prefers-reduced-motion` path — the morph degrades to an instant swap with no beat or auto-scroll.

### Don't:
- **Don't** make it feel corporate or sterile — no cold, over-formal enterprise-dashboard chrome. Warmth comes from Ember + reading type.
- **Don't** use flashy or gimmicky motion (bounce, elastic, decorative effects). Motion must explain the diff.
- **Don't** ship the generic AI-SaaS template: no cream/sand body background, no tiny tracked-uppercase eyebrows above sections, no hero-metric block, no endless identical card grids.
- **Don't** use loud color, neon, or gradients; the change washes stay soft and the accent stays singular.
- **Don't** use a `border-left`/`border-right` colored stripe as an accent; use full hairline borders or a leading chip/number.
- **Don't** use gradient text (`background-clip: text`) or decorative glassmorphism.
- **Don't** introduce a second saturated color or a display headline larger than ~22px (The No-Hero Rule).
