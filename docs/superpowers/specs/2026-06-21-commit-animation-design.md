# Commit Animation — Design

**Date:** 2026-06-21
**Status:** Approved (design phase)

## Summary

A hosted web app that animates how a single file evolves across its git
history. A user supplies a public repository URL and a file path; the service
extracts the file's content at each commit, stores a self-contained snapshot,
and returns a shareable permalink. Anyone holding the link can play back a
smooth **line-level diff morph** — unchanged lines slide to their new
positions while added lines grow/fade in and removed lines collapse/fade out —
with a timeline scrubber, playback controls, and per-commit metadata.

## Goals

- Deployable hosted service others can use.
- Public repository URLs on the public deployment; local paths as a self-host
  convenience only.
- Share animations via **link-possession permission**: possessing the
  unguessable URL is the only credential — no accounts, no ACLs.
- Self-contained stored snapshots so shared links are fast, never re-clone, and
  survive the source repo changing or disappearing.
- Signature animation: line-level diff morph between consecutive commits.

## Non-Goals (v1)

- Syntax highlighting (deferred to v2; the data model carries a `language`
  field to make this additive).
- Uploading private repos / `.git` bundles on the public service.
- User accounts, authentication, or per-animation access control beyond the
  unguessable link.
- Animating multiple files or whole-directory views.
- Serverless deployment (server-side cloning needs a real filesystem + time).

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo sources | Public URLs (public deploy) + local path (self-host only) | Matches the deploy model; avoids untrusted upload pipeline in v1. |
| Share model | Stored snapshot (self-contained) | Fast viewers, no re-clone, robust to source repo changes/deletion. |
| Commit range | Full file history, capped at 100 most recent | Sane default; `truncated` flag warns when exceeded. |
| Animation | Line-level diff morph (FLIP) | Most informative + compelling; you watch the code evolve. |
| Syntax highlighting | Deferred to v2 | Nice-to-have; data model leaves room for it. |
| Stack | Next.js full-stack + SQLite + Motion, in Docker | Fewest moving parts, single deploy artifact, Motion layout animations fit the morph. |
| Diff computation | At playback (client), from stored raw content | Keeps stored data small/simple; morph logic lives where it renders. |

## Architecture

A single Next.js app (App Router), deployed as one Docker image that includes
the `git` binary.

### Frontend (React + Motion)

- `CreatePage` (`/create`) — form (repo URL or local path + file path); submits
  and shows live extraction progress via SSE.
- `PlayerPage` (`/a/[id]`) — the shareable permalink; loads a stored animation
  and plays it.
- Player components:
  - `CodeViewport` — renders the current file state and the morph.
  - `Timeline` — scrubber across commits with tick marks.
  - `Controls` — play/pause, prev/next, speed.
  - `CommitInfo` — short hash, message (first line), author, timestamp, position.

### Backend (Next route handlers)

- `POST /api/animations` — validate → extract → store → return `{ id }`.
  Streams progress as Server-Sent Events.
- `GET /api/animations/:id` — return the stored animation payload for playback.

### Core modules (plain TS, framework-free, unit-testable)

- `git/clone.ts` — blobless, no-checkout clone into a temp dir (`execFile`).
- `git/history.ts` — `git log --follow --name-status` → ordered commits + the
  file's path at each commit (handles renames).
- `git/snapshot.ts` — `git show <sha>:<path>` → file content per commit.
- `extract.ts` — orchestrates clone → history → snapshots → builds the record;
  cleans up the temp dir.
- `diff.ts` — pure function: two file strings → keyed line ops (the morph core).
- `store/` — SQLite persistence via the repository pattern (`create`,
  `findById`).
- `validate.ts` — input validation + SSRF / host-allowlist guards.

### Storage

SQLite via `better-sqlite3`; one `animations` table; gzipped JSON payload.

## Data Model

The animation **ID is the permission**: a short, unguessable, non-enumerable
URL-safe `nanoid` (16 chars). `/a/<id>` is the link-possession capability.

### `animations` table

| column | type | notes |
|---|---|---|
| `id` | TEXT PK | nanoid |
| `repo_url` | TEXT | source, for display/attribution (null for local self-host) |
| `file_path` | TEXT | |
| `language` | TEXT | guessed from extension (forward-looking for v2 syntax HL) |
| `commit_count` | INTEGER | |
| `truncated` | INTEGER | 1 if history exceeded the cap |
| `byte_size` | INTEGER | for limits/metrics |
| `payload` | BLOB | gzipped JSON (below) |
| `created_at` | INTEGER | epoch ms |

### `payload` JSON (v1 schema)

```jsonc
{
  "version": 1,
  "repo": { "url": "...", "displayName": "owner/repo" },
  "filePath": "src/foo.ts",
  "language": "typescript",
  "truncated": false,
  "commits": [                    // chronological: oldest -> newest
    {
      "sha": "…", "shortSha": "c40c235",
      "message": "First commit",  // full message stored; UI shows first line
      "author": { "name": "…", "email": "…" },
      "timestamp": "2026-06-20T13:46:00Z",
      "content": "…file text at this commit…",
      "status": "added"           // added | modified | deleted
    }
  ]
}
```

Only raw content per commit is stored. The client diffs `commit[i]` vs
`commit[i+1]` (`diffLines`) and assigns stable keys to lines so Motion can FLIP
unchanged lines into place and fade added/removed ones.

### Limits (constants, enforced at extraction)

- Max 100 commits (else keep the 100 most recent, set `truncated`).
- Max ~256 KB per file snapshot.
- Max ~5 MB gzipped total payload.
- Binary files rejected with a clear message.

## Extraction Pipeline & Security

`POST /api/animations` flow (orchestrated by `extract.ts`):

1. **Validate** (`validate.ts`) — reject early with clear errors.
2. **Clone** (`git/clone.ts`) —
   `execFile('git', ['clone','--filter=blob:none','--no-checkout','--single-branch', url, tmp])`
   into a fresh `mkdtemp` dir. Hardened env: `GIT_TERMINAL_PROMPT=0`, no
   credential helpers, submodules never recursed. Hard timeout.
3. **History** (`git/history.ts`) —
   `git -C tmp log --follow --name-status --format=… -- <path>`. Produces
   ordered commits and the file's path at each commit (renames resolve). Cap to
   the 100 most recent; set `truncated`.
4. **Snapshots** (`git/snapshot.ts`) — per commit,
   `git -C tmp show <sha>:<path-at-that-commit>`. Enforce per-file byte cap;
   detect binary (null byte) and abort with a friendly message. Deletion
   commits → empty content, `status: "deleted"`.
5. **Build + store** — assemble payload, gzip, enforce total cap, insert row,
   return `{ id }`.
6. **Cleanup** — temp dir removed in a `finally`, always.

**Progress UX:** the create call streams Server-Sent Events —
`{phase:"cloning"} → {phase:"history"} → {phase:"snapshots", current, total} →
{done, id}`. A plain-POST fallback exists if SSE proves fussy.

### Security checklist (enforced, not aspirational)

- **No shell, ever** — `execFile` with argument arrays; user input never
  interpolated into a command string.
- **URL guard** — `https://` only; host allowlist (github.com, gitlab.com,
  bitbucket.org, codeberg.org); strip embedded credentials; resolve and block
  private/loopback/link-local IP ranges (SSRF defense in depth); reject
  `file://`, `ssh://`, `git://`.
- **Path guard** — normalize; reject absolute paths and `..` traversal; must
  stay within the repo.
- **Resource caps** — clone timeout, blobless + single-branch, 100-commit cap,
  256 KB/file, ~5 MB total payload, max concurrent clones, per-IP rate limiting.
- **Isolation** — each job in its own temp dir; guaranteed cleanup; disk
  pressure bounded by the caps above.
- **Local-path mode** — off by default; enabled only via env flag for
  self-host, restricted to a configured root directory.

## Playback & UI

### `/a/[id]` layout (top → bottom)

- **Header strip** — `owner/repo · src/foo.ts` left; a small "Create your own"
  link right.
- **Commit info bar** — `shortSha · message (first line) · author · relative
  time (hover = exact)` plus position `12 / 42`, directly above the code.
- **Code viewport** — large monospace panel, line numbers, current file state,
  where the morph happens; scrolls for long files.
- **Timeline + controls (footer)** — scrubber slider across commits with tick
  marks; play/pause, prev/next; speed control (dwell-per-commit, 0.5×–4×).
  Scrubbing sets `currentIndex` directly.

### `/create` page

Two inputs (repo URL, file path), submit, then a live SSE progress readout
(`Cloning… → Reading history… → Extracting 12/42`). On `done`, redirect to
`/a/[id]`.

### Playback mechanics

- State: `currentIndex`, `isPlaying`, `speed`. A timer advances the index by the
  dwell duration while playing; pause clears it; scrubber/prev/next set the
  index directly.
- **The morph:** for `commit[i] → commit[i+1]`, run `diffLines(prev, next)` and
  build one keyed line list aligned from the diff:
  - *Unchanged* lines keep stable keys (matched content + occurrence) → Motion
    `layout` FLIP-slides them to new positions.
  - *Added* lines → new keys, enter via `AnimatePresence` (height expand + fade,
    green tint settling to neutral).
  - *Removed* lines → exit (height collapse + fade, red tint).
- The stable-key alignment is isolated in `diff.ts` (pure: two strings → keyed
  line ops) so it is unit-testable independent of rendering.
- **Reduced motion:** respect `prefers-reduced-motion` → fall back to a plain
  crossfade between states.

## Error Handling

Friendly message to the user, detailed context in server logs, nothing
swallowed.

| Situation | User sees |
|---|---|
| Bad/disallowed URL, path traversal | 400 inline: "That repository host isn't supported / that path isn't allowed." |
| Clone fails / private / 404 repo | "Couldn't access that repository — is it public?" |
| File not in repo | "That path doesn't exist in this repository." |
| Binary file | "That looks like a binary file — only text/code files are supported." |
| File too big / caps exceeded | "That file is too large to animate (max 256 KB)." History over cap → keep latest 100 + a `truncated` badge. |
| Clone/extraction timeout | "That took too long — try a smaller file or repo." |
| `GET /a/:id` missing | 404 page: "Animation not found." |
| SSE drops mid-extraction | Surface error + a Retry button. |
| Single-commit file | Valid — a one-frame animation, no error. |

## Testing (TDD, ≥80% coverage)

- **Unit** — `validate.ts` (allowlist, traversal, SSRF/private-IP cases);
  `diff.ts` (keyed line-alignment — heaviest coverage); `git/history.ts` +
  `git/snapshot.ts` parsing; `store` CRUD against a temp SQLite file; language
  guess.
- **Integration** — `POST /api/animations` end-to-end in local-path mode against
  tiny fixture git repos built in test setup (real `git`, no network), asserting
  the stored payload; `GET` round-trip; SSE event sequence.
- **Component** — `Player` state machine (play/pause/scrub/step), `Timeline`,
  `Controls`; `CodeViewport` morph with a mocked diff.
- **E2E (Playwright)** — create from a fixture repo → redirect → play → scrub →
  step.
- **Security tests (explicit)** — disallowed host, path traversal, private IP,
  binary, oversize all rejected.

Fixture repos are throwaway git repos constructed in test setup, so git modules
are exercised for real without network access.
