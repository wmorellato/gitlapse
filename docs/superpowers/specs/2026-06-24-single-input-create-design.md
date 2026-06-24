# Single-Input Create Flow — Design

**Date:** 2026-06-24
**Status:** Approved (design); pending spec review

## Problem

The create form requires two separate inputs: a repository URL/path and a relative file path. This is redundant friction:

- **Remote:** users already have the file's web URL in hand (e.g. `https://github.com/owner/repo/blob/main/src/index.ts`), which contains the host, repo, ref, and path. Making them split it by hand is busywork.
- **Local:** when local repos are enabled, the enclosing git repository can be discovered from an absolute file path by walking up to the nearest `.git`. Requiring the repo path separately is unnecessary.

The goal: accept a **single input** — a file URL (remote) or an absolute file path (local) — and infer repo + path on the server, while keeping the explicit two-field form as a fallback.

## Goals

- One primary input that accepts a remote file URL or (when enabled) an absolute local file path.
- Server infers `{ repoInput, filePath }` and feeds the existing extraction pipeline unchanged.
- Keep the explicit two-field entry available as a fallback.
- Preserve all current validation: host allowlist, SSRF guard, path-traversal checks, `LOCAL_ROOT` containment.
- Clear, friendly errors for ambiguous or unsupported input.

## Non-Goals

- **No branch/ref support (v1).** A ref present in a URL is parsed and discarded; extraction always uses the default branch (today's behavior). A quiet UI note communicates this.
- No changes to the clone/history/snapshot/store pipeline, or to SSRF/allowlist logic.
- No client-side filesystem access or client-side repo discovery.
- No support for bare `owner/repo` shorthand or non-allowlisted hosts.

## Chosen Approach: server-side `resolveInput` layer

A new pure function `resolveInput(raw)` turns one string into the `{ repoInput, filePath }` pair the existing `extractAnimation` already consumes. All current validation and the extraction pipeline stay as-is; this is a thin parsing layer in front of them.

Rejected alternatives:

- **Push parsing into `resolveSource`/`validate`:** tangles URL-shape parsing into the clean, well-tested SSRF/validation code. More risk, no benefit.
- **Parse in the browser (`CreateForm`):** cannot do local-FS repo discovery client-side, and path edge cases are better handled server-side.

## Architecture

### New module: `src/lib/source.ts`

```ts
resolveInput(raw: string): { repoInput: string; filePath: string }
```

Classifies `raw` and returns the pair, or throws `ValidationError` with a friendly message + code. It does **not** itself clone or hit the network for remote URLs (the downstream `resolveSource` still runs `assertPublicHost` etc.); for local input it may invoke `git rev-parse` to find the repo root.

### Disambiguation order

1. **Remote file URL** — parses as an `https://` URL whose host is in `ALLOWED_HOSTS` **and** whose path matches that host's blob shape → produce `repoInput = https://host/owner/repo`, `filePath = <decoded in-repo path>`. Ref segment parsed then discarded.
2. **Local absolute file path** — only when `ALLOW_LOCAL_PATHS === "1"`; `raw` starts with `/`, or is a `file://` URL (stripped to its path) → infer repo root + relative path.
3. **Bare repo URL, no file** (allowlisted host, no blob path) → error code `need_file`: "That's a repository URL — paste a link to a file, or use manual entry."
4. **Allowlisted host but non-file path** (e.g. an issues/tree page) → error code `not_a_file_url`: "That doesn't look like a link to a file in the repo."
5. **Anything else** → error code `unrecognized_input`: "Couldn't tell what that is — paste a file's URL (or an absolute file path), or enter the repo and path manually."

### Remote URL parsing (per-host blob shapes)

Parse `URL.pathname` segments after `owner/repo`:

- GitHub: `/owner/repo/blob/<ref>/<path...>`
- GitLab: `/owner/repo/-/blob/<ref>/<path...>`
- Bitbucket: `/owner/repo/src/<ref>/<path...>`
- Codeberg: `/owner/repo/src/branch/<ref>/<path...>`

`repoInput = "https://" + host + "/" + owner + "/" + repo` (drop any trailing `.git`). `filePath` = the remaining path segments joined with `/`, URL-decoded. `<ref>` is captured to detect "a ref was present" (drives the UI note) but is not used for extraction. The produced `repoInput` and `filePath` then flow through the existing `validateRepoUrl` → `assertPublicHost` and `validateFilePath`, so the allowlist, SSRF guard, and traversal checks are unchanged.

### Local repo inference

When input is an absolute file path and `ALLOW_LOCAL_PATHS === "1"`:

1. Resolve to an absolute path; confirm it is inside `LOCAL_ROOT` (reuse the `validateLocalPath` containment rule).
2. Find the repo root: `git -C <dirname(file)> rev-parse --show-toplevel`.
3. Confirm the repo root is **also** inside `LOCAL_ROOT`.
4. `filePath` = file path relative to the repo root (POSIX separators); `repoInput` = the repo root.
5. Errors: outside `LOCAL_ROOT` → existing "outside the allowed root" (`bad_path`); no enclosing `.git` (git command fails / not a repo) → error code `no_repo_found`: "No git repository found above that file."; local disabled → existing `local_disabled`.

The inferred pair feeds the existing local branch of `resolveSource`, which already git-clones a local directory into a temp dir. Only committed history animates (unchanged behavior; uncommitted edits do not appear).

### API & data flow

`POST /api/animations` accepts **either** body shape:

- `{ input: string }` → route calls `resolveInput(input)` to get `{ repoInput, filePath }`, then proceeds into the unchanged SSE extraction flow. A thrown `ValidationError` is reported over SSE as today (message + code).
- `{ repoInput, filePath }` (manual fallback) → unchanged from today; bypasses `resolveInput`.

If both are absent → existing `bad_input` error.

### Form UX (`CreateForm`)

- Primary: one input labeled e.g. "Paste a file's URL", placeholder `https://github.com/owner/repo/blob/main/src/index.ts`. Submitting posts `{ input }`.
- A small "enter repo + path manually" toggle reveals today's two fields; submitting that mode posts `{ repoInput, filePath }`.
- On-brand: single ember accent, no new chrome, reuse existing field/button styles.
- Default-branch note: **deferred to a later version** (see Non-Goals). v1 parses any ref in the URL and silently discards it; no note is shown and no signal is threaded through the API. This avoids a cross-cutting change for a nice-to-have.

## Error Handling

All failures are `ValidationError`s with stable codes, surfaced through the existing SSE `error` event and the form's `role="alert"` message:

- `need_file`, `not_a_file_url`, `unrecognized_input` — from `resolveInput` classification.
- `no_repo_found` — local inference found no enclosing repo.
- Reused: `bad_path`, `local_disabled`, `bad_url`, `not_found`.

## Testing

- **`resolveInput` unit tests** (`tests/lib/source.test.ts`):
  - Each host blob shape (GitHub/GitLab/Bitbucket/Codeberg) → correct `{repoInput, filePath}`; trailing `.git` stripped; nested paths and URL-encoded segments decoded.
  - Ref is stripped (different refs, same repo+path result).
  - Bare repo URL → `need_file`; allowlisted host non-file path → `not_a_file_url`; junk → `unrecognized_input`.
  - Local: absolute file path inside a temp git repo → inferred repo root + relative path (use a temp git fixture, like `tests/fixtures/git.ts`).
  - Local: path outside `LOCAL_ROOT` → `bad_path`; file with no enclosing `.git` → `no_repo_found`; `ALLOW_LOCAL_PATHS` unset → `local_disabled`.
- **API test** (`tests/api/post-animation.test.ts` or a sibling): `{ input }` happy path resolves and starts extraction; bad input returns the right error code; `{ repoInput, filePath }` still works.
- **Component test** (`tests/components/createForm.test.tsx`): single field submits `{ input }`; manual toggle reveals two fields and submits `{ repoInput, filePath }`.
- **E2E** (`tests/e2e/`): extend the existing local-repo flow to submit a single absolute file path and reach the player.

## Notes

- **Ref handling decided:** v1 parses and silently discards the ref; no UI note (see Form UX and Non-Goals). Honoring refs and surfacing a default-branch note are explicit later-version work.
- Renames remain handled by `getHistory --follow` (rename-aware `pathAtCommit`), unchanged.
- `file://` handling for local input is a convenience; if it complicates parsing, accept plain absolute paths only and treat `file://` as `unrecognized_input`.
