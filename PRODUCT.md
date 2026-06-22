# Product

## Register

product

## Users

People who want to **show how a file evolved over time** — developers and writers turning a file's git history (code or prose/markdown) into a smooth, watchable animation. Their primary intent is sharing: they generate an animation and hand someone an unguessable link ("watch how this got written/built"). Context of use is split: the **creator** is briefly in a utility flow (paste a public repo URL + file path, wait for extraction), while the **viewer** is in a lean-back, watch-it-play mode, often on a link they were sent.

## Product Purpose

Commit Animation extracts a single file's content at each commit and plays it back as a line-level "diff morph": unchanged lines glide to their new positions while added lines grow in and removed lines collapse out, with a soft anticipation highlight before each change. The result is a self-contained, shareable artifact at `/a/<id>`. Success looks like: a creator finishes the create flow without friction, the resulting playback is satisfying enough that they want to share it, and a recipient who opens the link immediately understands what they're watching and enjoys it.

## Brand Personality

**Calm · precise · delightful.** Voice is quiet, plain-spoken, and technically honest — no hype. The interface stays out of the way so the content reads clearly, and the delight comes from craft (smooth, intentional motion; accurate diffing) rather than decoration. Friendly and a little warm, never corporate or sterile.

## Anti-references

- **Corporate/sterile SaaS.** Cold, over-formal, faceless enterprise dashboards. Keep some warmth and personality.
- **Flashy/gimmicky motion.** No bounce/elastic, no gratuitous effects, no "look what we can animate." Motion must serve comprehension of the change.
- **Generic AI-SaaS template.** Avoid the cream-bg + tracked-uppercase-eyebrow + hero-metric + identical-card-grid scaffold.
- **Loud color.** No neon, no heavy gradients; the change-highlight washes stay soft.

## Design Principles

- **The morph is the message.** The animating content is the star; chrome recedes. Every UI decision protects attention on the playback.
- **Calm utility, delightful payoff.** The create flow is frictionless and unglamorous; the player is where craft and delight concentrate.
- **Legibility is non-negotiable.** Prose/markdown is the main content, so reading comfort (typography, wrapping, measure, contrast) wins over visual flourish.
- **Every animation is a shareable artifact.** Treat the player as something a stranger will open cold — it must be self-explanatory and worth showing.
- **Delight through craft, not gimmicks.** Smoothness, precise line identity, and honest transitions earn the "satisfying" feeling; tricks don't.

## Accessibility & Inclusion

- Target **WCAG 2.1 AA** contrast (body text ≥4.5:1, large text ≥3:1), including placeholder and muted text.
- **Reduced motion is honored** (`prefers-reduced-motion`): the morph degrades to an instant swap with no anticipation beat or auto-scroll.
- **Change cues are not color-only.** Add/remove is also conveyed by motion (grow/collapse) and position, so the soft green/rose washes are never the sole signal — safe for color-blind viewers.
- Controls are real, labeled buttons; the timeline is a native, keyboard-operable range input; visible `:focus-visible` rings throughout.
