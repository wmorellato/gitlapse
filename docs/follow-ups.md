# Follow-ups

Tracked, non-blocking items to revisit.

## Security: harden `validateLocalPath` against symlink escape

`src/lib/validate.ts` `validateLocalPath` compares paths **lexically** (`path.resolve`
+ string prefix check against `LOCAL_ROOT`), not via `fs.realpath`. A symlink placed
*inside* `LOCAL_ROOT` that points outside it can therefore defeat containment: the
symlinked path string-matches `LOCAL_ROOT` while the real target is elsewhere. This
affects both the existing local-repo fallback and the single-input local inference
(`inferLocalSource` in `src/lib/source.ts`, which re-validates the file and the
`git rev-parse --show-toplevel` root through `validateLocalPath`).

- **Severity:** low in practice — local paths are a self-host opt-in (`ALLOW_LOCAL_PATHS=1`)
  and the operator controls `LOCAL_ROOT`.
- **Pre-existing:** not introduced by the single-input feature; that feature inherits it.
- **Fix (if pursued):** `fs.realpath` the file path, the inferred repo root, and
  `LOCAL_ROOT` before the containment comparison. Note this is **behavior-changing** —
  it would resolve symlinked setups (e.g. a symlinked repos dir, or `/tmp`→`/private/tmp`
  on macOS), so re-check the existing local-path tests and the e2e `LOCAL_ROOT` when doing so.
- **Source:** flagged in the 2026-06-24 single-input-create final whole-branch review.
