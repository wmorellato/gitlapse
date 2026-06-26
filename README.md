# Gitlapse

Watch a single file evolve across its git history — a calm, share-worthy diff morph.

Gitlapse extracts one file's content at each commit and plays it back as a line-level "diff morph": unchanged lines glide to their new positions, added lines grow in, and removed lines collapse out, with a soft anticipation highlight before each change. The result is a self-contained, shareable artifact at `/a/<id>` — hand someone an unguessable link and they can watch how a file got written or built.

https://github.com/user-attachments/assets/55da47f1-0694-4760-a9da-45a5d962675f

## How it works

1. You paste a **public repository URL** and a **file path** into the create form.
2. The server shallow-clones the repo, walks the file's commit history, and snapshots the file's content at each commit.
3. The extracted timeline is gzipped and stored in SQLite, keyed by an unguessable id.
4. The viewer opens `/a/<id>` and watches the morph play back, with a scrubbable timeline, play/pause, and per-commit metadata.

The content font adapts to the file type: prose and markdown render in proportional sans (no line numbers); code renders in monospace (with a line-number gutter). Reduced motion (`prefers-reduced-motion`) is honored — the morph degrades to an instant swap.

## Tech stack

- **Next.js 15** (App Router) + **React 19**, TypeScript
- **motion** (Framer Motion) for the diff morph
- **better-sqlite3** for storage (gzipped payloads)
- **Vitest** (unit/integration) + **Playwright** (E2E)
- Node **>= 20**

## Quick start (development)

```bash
npm install
npm run dev
```

Then open <http://localhost:3000> — the root redirects to `/create`.

Out of the box you can animate files from these public hosts (https only):
`github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (Next.js standalone output) |
| `npm run start` | Run the production build |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run e2e` | Run the Playwright E2E tests |

> **Note:** `better-sqlite3` is a native addon. If the Vitest suite reports a handful of sqlite-related failures, run `npm rebuild better-sqlite3` and re-run.

## Running against local repositories

By default the server only accepts allowlisted **public** URLs and refuses any host that resolves to a private/loopback address (SSRF protection). For self-hosting, you can additionally allow animating repositories straight off the local filesystem — no remote, no clone over the network.

Enable it with two environment variables:

| Variable | Purpose |
| --- | --- |
| `ALLOW_LOCAL_PATHS=1` | Turns on local-path support. Off by default. |
| `LOCAL_ROOT` | Absolute path that local repos must live under. Paths outside this root are rejected. Defaults to the current working directory. |

When enabled, anything in the "Repository" field that isn't a valid allowlisted URL is treated as a local path, resolved, and checked against `LOCAL_ROOT`.

Example — serve animations for any repo under `~/repos`:

```bash
ALLOW_LOCAL_PATHS=1 LOCAL_ROOT="$HOME/repos" npm run dev
```

Then in the create form:

- **Repository:** `/home/you/repos/my-project`
- **File path:** `src/index.ts` (relative to the repo root)

Local paths are git-cloned locally into a temp dir just like remote repos, so the target must be a valid git repository.

> **Security:** Only enable `ALLOW_LOCAL_PATHS` on a trusted, single-user instance. Always set `LOCAL_ROOT` to the narrowest directory that contains the repos you want to expose — it is the only thing preventing arbitrary filesystem access through the create form. Leave it disabled for any public-facing deployment.

## Configuration

All configuration is via environment variables.

| Variable | Default | Description |
| --- | --- | --- |
| `DB_FILE` | `.data/animations.db` | SQLite database file path |
| `ALLOW_LOCAL_PATHS` | _(unset)_ | Set to `1` to allow local filesystem repos |
| `LOCAL_ROOT` | cwd | Root directory local repos must live under |
| `LANDING_EXAMPLE_IDS` | _(unset)_ | Comma-separated `/a/<id>` ids to autoplay as the demo on the landing page; first that exists is used. Unset → no demo, just headline + CTA. |

Operational limits (in `src/lib/constants.ts`): up to **100 commits** per file, **256 KB** max file size, **5 MB** max stored payload, **60s** clone timeout, **10 requests/min** per IP, and **4** concurrent extractions.

## Deploying with Docker

The included `Dockerfile` produces a standalone production image and persists the database to a volume.

```bash
# Build the image
docker build -t gitlapse .

# Run it, persisting the SQLite DB to a named volume
docker run -p 3000:3000 -v gitlapse-data:/app/.data gitlapse
```

The container exposes port `3000`, stores its database at `/app/.data/animations.db` (mounted as a volume), and includes `git` for cloning. It does **not** enable local-path support — pass `-e ALLOW_LOCAL_PATHS=1` and mount your repos plus set `LOCAL_ROOT` if you want that on a private instance.

## Project layout

```
src/
  app/                  Next.js routes (create form, /a/[id] player, API)
    api/animations/     POST (create, SSE progress) + GET by id
  components/           Player, CodeViewport, Timeline, Controls, Minimap, …
  lib/
    extract.ts          Orchestrates clone -> history -> snapshots
    validate.ts         URL/path validation, SSRF guard, local-path gate
    git/                clone / history / snapshot helpers
    store/              SQLite persistence (gzipped payloads)
tests/                  Vitest unit/integration + Playwright E2E
```
