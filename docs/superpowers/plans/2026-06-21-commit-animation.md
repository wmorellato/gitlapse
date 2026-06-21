# Commit Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hosted web app that animates how a single file evolves across its git history, shareable via an unguessable permalink.

**Architecture:** Single Next.js (App Router) app deployed as one Docker image containing the `git` binary. Server-side route handlers clone a public repo (blobless, no-checkout), extract one file's content at each commit, and store a gzipped self-contained snapshot in SQLite. The client loads a stored snapshot from an unguessable `/a/<id>` URL and plays it back with a line-level morph (Motion FLIP), a timeline scrubber, and playback controls.

**Tech Stack:** Next.js 15 / React 19 / TypeScript 5, `better-sqlite3`, `nanoid`, `motion` (Framer Motion), Vitest + Testing Library (unit/component/integration), Playwright (E2E). Git via Node `child_process.execFile` (no shell).

## Global Constraints

- **Node:** >= 20.
- **No shell for git:** always `execFile('git', [args...])` with an argument array; never interpolate user input into a command string.
- **Animation ID:** 16-char URL-safe `nanoid`; the ID is the only access credential (link-possession). Never enumerable, never logged in full alongside repo data.
- **Caps (verbatim):** max 100 commits (keep most recent, set `truncated`); max 262144 bytes (256 KB) per file snapshot; max 5242880 bytes (5 MB) gzipped total payload; clone timeout 60000 ms.
- **Host allowlist (verbatim):** `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org`. `https://` only. Reject `file://`, `ssh://`, `git://`, embedded credentials, and hosts resolving to private/loopback/link-local IPs.
- **Local-path mode:** off unless `ALLOW_LOCAL_PATHS=1`; when on, paths must resolve under `LOCAL_ROOT`.
- **TDD:** every code change starts with a failing test. Commit after each task.
- **Payload schema version:** `version: 1`.

---

## File Structure

```
package.json, tsconfig.json, next.config.mjs, vitest.config.ts, playwright.config.ts, Dockerfile, .dockerignore
src/
  lib/
    types.ts            # shared types (CommitMeta, CommitSnapshot, AnimationPayload, AnimationRecord)
    constants.ts        # caps, allowlist, env flags
    language.ts         # file extension -> language string
    diff.ts             # pure: content -> keyed render lines (morph identity)
    validate.ts         # URL/path validation + SSRF guard
    git/clone.ts        # blobless no-checkout clone into temp dir
    git/history.ts      # git log --follow parsing -> CommitMeta[]
    git/snapshot.ts     # git show <sha>:<path> -> content (+ binary detection)
    extract.ts          # orchestrator: validate -> clone -> history -> snapshot -> payload
    store/db.ts         # sqlite connection + schema
    store/animations.ts # repository: createAnimation, findAnimation
  app/
    layout.tsx
    page.tsx            # redirects to /create
    create/page.tsx     # CreateForm host
    a/[id]/page.tsx     # PlayerPage (server: load record -> <Player>)
    a/[id]/not-found.tsx
    api/animations/route.ts        # POST (SSE progress, returns {done,id})
    api/animations/[id]/route.ts   # GET payload
  components/
    CreateForm.tsx      # client: inputs + SSE progress, redirect on done
    Player.tsx          # client container, owns playback state
    usePlayer.ts        # playback state-machine hook
    CodeViewport.tsx    # morph rendering
    Timeline.tsx        # scrubber
    Controls.tsx        # play/pause/prev/next/speed
    CommitInfo.tsx      # hash/message/author/time/position
tests/
  fixtures/git.ts       # helper: build throwaway git repos in a temp dir
```

---

## Task 1: Project scaffold + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: working `npm test` (Vitest) and `npm run build` (Next).

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "commit-animation",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "motion": "^11.15.0",
    "better-sqlite3": "^11.7.0",
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^20.17.0",
    "@types/react": "^19.0.0",
    "@types/better-sqlite3": "^7.6.12",
    "vitest": "^2.1.8",
    "@vitejs/plugin-react": "^4.3.4",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "jsdom": "^25.0.1",
    "@playwright/test": "~1.60.0"
  }
}
```

- [ ] **Step 2: Create config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "incremental": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["better-sqlite3"]
};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["**/node_modules/**", "tests/e2e/**"]
  },
  resolve: { alias: { "@": resolve(__dirname, "src") } }
});
```

`.gitignore`:
```
node_modules
.next
*.db
.data
test-results
playwright-report
```

- [ ] **Step 3: Create minimal app shell + failing smoke test**

`src/app/layout.tsx`:
```tsx
export const metadata = { title: "Commit Animation" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`:
```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/create");
}
```

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs tests", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Install + run**

Run: `npm install && npm test`
Expected: smoke test PASSES.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest tooling"
```

---

## Task 2: Shared types + constants

**Files:**
- Create: `src/lib/types.ts`, `src/lib/constants.ts`
- Test: `tests/lib/constants.test.ts`

**Interfaces:**
- Produces: `CommitMeta`, `CommitSnapshot`, `AnimationPayload`, `AnimationRecord`; constants `MAX_COMMITS`, `MAX_FILE_BYTES`, `MAX_PAYLOAD_BYTES`, `CLONE_TIMEOUT_MS`, `ALLOWED_HOSTS`, `BASE_DWELL_MS`, `ALLOW_LOCAL_PATHS`, `LOCAL_ROOT`.

- [ ] **Step 1: Write failing test**

`tests/lib/constants.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { MAX_COMMITS, MAX_FILE_BYTES, MAX_PAYLOAD_BYTES, ALLOWED_HOSTS } from "@/lib/constants";

describe("constants", () => {
  it("matches the spec caps", () => {
    expect(MAX_COMMITS).toBe(100);
    expect(MAX_FILE_BYTES).toBe(262144);
    expect(MAX_PAYLOAD_BYTES).toBe(5242880);
    expect(ALLOWED_HOSTS).toEqual(["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: FAIL — cannot find module `@/lib/constants`.

- [ ] **Step 3: Implement**

`src/lib/constants.ts`:
```ts
export const MAX_COMMITS = 100;
export const MAX_FILE_BYTES = 262144;        // 256 KB
export const MAX_PAYLOAD_BYTES = 5242880;    // 5 MB
export const CLONE_TIMEOUT_MS = 60000;
export const ALLOWED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org", "codeberg.org"] as const;
export const BASE_DWELL_MS = 1500;
export const ALLOW_LOCAL_PATHS = process.env.ALLOW_LOCAL_PATHS === "1";
export const LOCAL_ROOT = process.env.LOCAL_ROOT ?? "";
```

`src/lib/types.ts`:
```ts
export type CommitStatus = "added" | "modified" | "deleted";

export interface CommitMeta {
  sha: string;
  shortSha: string;
  message: string;          // full message; UI shows first line
  author: { name: string; email: string };
  timestamp: string;        // ISO 8601
  pathAtCommit: string;     // file path valid at this commit (rename-aware)
  status: CommitStatus;
}

export interface CommitSnapshot {
  sha: string;
  shortSha: string;
  message: string;
  author: { name: string; email: string };
  timestamp: string;
  content: string;
  status: CommitStatus;
}

export interface AnimationPayload {
  version: 1;
  repo: { url: string | null; displayName: string };
  filePath: string;
  language: string;
  truncated: boolean;
  commits: CommitSnapshot[];
}

export interface AnimationRecord {
  id: string;
  repoUrl: string | null;
  filePath: string;
  language: string;
  commitCount: number;
  truncated: boolean;
  byteSize: number;
  createdAt: number;
  payload: AnimationPayload;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shared types and constants"
```

---

## Task 3: Language detection

**Files:**
- Create: `src/lib/language.ts`
- Test: `tests/lib/language.test.ts`

**Interfaces:**
- Produces: `detectLanguage(filePath: string): string` — returns a language id (e.g. `"typescript"`) or `"plaintext"`.

- [ ] **Step 1: Write failing test**

`tests/lib/language.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { detectLanguage } from "@/lib/language";

describe("detectLanguage", () => {
  it("maps known extensions", () => {
    expect(detectLanguage("src/foo.ts")).toBe("typescript");
    expect(detectLanguage("a/b/main.py")).toBe("python");
    expect(detectLanguage("README.md")).toBe("markdown");
  });
  it("falls back to plaintext for unknown/none", () => {
    expect(detectLanguage("LICENSE")).toBe("plaintext");
    expect(detectLanguage("data.xyz")).toBe("plaintext");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/language.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/language.ts`:
```ts
const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", cs: "csharp",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml",
  md: "markdown", html: "html", css: "css", sh: "bash", sql: "sql"
};

export function detectLanguage(filePath: string): string {
  const base = filePath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = base.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] ?? "plaintext";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/language.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add file-extension language detection"
```

---

## Task 4: Diff line-keying (morph core)

**Files:**
- Create: `src/lib/diff.ts`
- Test: `tests/lib/diff.test.ts`

**Design note:** Stable line identity for FLIP is derived from `text + occurrence-index`. A line in the next frame is `"add"` if its key was absent from the previous frame; otherwise `"context"`. Removed lines simply have no entry in the next frame — Motion's `AnimatePresence` animates their exit. This occurrence-keying is more reliable for FLIP identity than a raw line diff and needs no external library.

**Interfaces:**
- Produces:
  - `interface RenderLine { key: string; text: string; change: "add" | "context" }`
  - `toKeys(content: string): string[]`
  - `toRenderLines(content: string, prevContent: string | null): RenderLine[]`

- [ ] **Step 1: Write failing test**

`tests/lib/diff.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toKeys, toRenderLines } from "@/lib/diff";

describe("toKeys", () => {
  it("disambiguates duplicate lines by occurrence", () => {
    expect(toKeys("a\na\nb")).toEqual(["a#0", "a#1", "b#0"]);
  });
  it("returns one entry for empty content", () => {
    expect(toKeys("")).toEqual([""]);
  });
});

describe("toRenderLines", () => {
  it("marks brand-new lines as add and retained lines as context", () => {
    const lines = toRenderLines("a\nb\nc", "a\nc");
    expect(lines.map((l) => l.text)).toEqual(["a", "b", "c"]);
    expect(lines.map((l) => l.change)).toEqual(["context", "add", "context"]);
  });
  it("treats everything as add when there is no previous frame", () => {
    const lines = toRenderLines("x\ny", null);
    expect(lines.every((l) => l.change === "add")).toBe(true);
  });
  it("gives retained lines stable keys across frames", () => {
    const prev = toRenderLines("a\nb", null);
    const next = toRenderLines("a\nb\nc", "a\nb");
    expect(next[0].key).toBe(prev[0].key);
    expect(next[1].key).toBe(prev[1].key);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/diff.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/diff.ts`:
```ts
export interface RenderLine {
  key: string;
  text: string;
  change: "add" | "context";
}

export function toKeys(content: string): string[] {
  const seen = new Map<string, number>();
  return content.split("\n").map((text) => {
    const n = seen.get(text) ?? 0;
    seen.set(text, n + 1);
    return `${text}#${n}`;
  });
}

export function toRenderLines(content: string, prevContent: string | null): RenderLine[] {
  const prevKeys = new Set(prevContent === null ? [] : toKeys(prevContent));
  const keys = toKeys(content);
  const texts = content.split("\n");
  return keys.map((key, i) => ({
    key,
    text: texts[i],
    change: prevContent === null || !prevKeys.has(key) ? "add" : "context"
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/diff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add occurrence-keyed line diffing for morph"
```

---

## Task 5: Input validation + SSRF guard

**Files:**
- Create: `src/lib/validate.ts`
- Test: `tests/lib/validate.test.ts`

**Interfaces:**
- Consumes: `ALLOWED_HOSTS`, `ALLOW_LOCAL_PATHS`, `LOCAL_ROOT` from `@/lib/constants`.
- Produces:
  - `class ValidationError extends Error { code: string }`
  - `validateFilePath(filePath: string): string` (returns normalized relative path; throws `ValidationError`)
  - `isPrivateIp(ip: string): boolean`
  - `validateRepoUrl(raw: string): URL` (throws `ValidationError`; does NOT do DNS)
  - `assertPublicHost(hostname: string): Promise<void>` (DNS resolves + rejects private IPs)
  - `validateLocalPath(raw: string): string` (only when `ALLOW_LOCAL_PATHS`; throws otherwise)

- [ ] **Step 1: Write failing test**

`tests/lib/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateFilePath, validateRepoUrl, isPrivateIp, ValidationError } from "@/lib/validate";

describe("validateFilePath", () => {
  it("accepts a normal relative path", () => {
    expect(validateFilePath("src/foo.ts")).toBe("src/foo.ts");
  });
  it("rejects traversal and absolute paths", () => {
    expect(() => validateFilePath("../etc/passwd")).toThrow(ValidationError);
    expect(() => validateFilePath("/etc/passwd")).toThrow(ValidationError);
  });
});

describe("validateRepoUrl", () => {
  it("accepts an allowlisted https host", () => {
    expect(validateRepoUrl("https://github.com/a/b").hostname).toBe("github.com");
  });
  it("rejects disallowed hosts, non-https, and embedded credentials", () => {
    expect(() => validateRepoUrl("https://evil.com/a/b")).toThrow(ValidationError);
    expect(() => validateRepoUrl("ssh://github.com/a/b")).toThrow(ValidationError);
    expect(() => validateRepoUrl("https://user:pw@github.com/a/b")).toThrow(ValidationError);
  });
});

describe("isPrivateIp", () => {
  it("flags loopback and private ranges", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
    expect(isPrivateIp("10.1.2.3")).toBe(true);
    expect(isPrivateIp("192.168.0.1")).toBe(true);
    expect(isPrivateIp("169.254.1.1")).toBe(true);
    expect(isPrivateIp("::1")).toBe(true);
  });
  it("allows public IPs", () => {
    expect(isPrivateIp("140.82.112.3")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/validate.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/validate.ts`:
```ts
import { promises as dns } from "node:dns";
import path from "node:path";
import { ALLOWED_HOSTS, ALLOW_LOCAL_PATHS, LOCAL_ROOT } from "@/lib/constants";

export class ValidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ValidationError";
  }
}

export function validateFilePath(filePath: string): string {
  const trimmed = filePath.trim().replace(/^\/+/, "");
  if (trimmed === "") throw new ValidationError("bad_path", "File path is required.");
  const normalized = path.posix.normalize(trimmed);
  if (normalized.startsWith("..") || normalized.includes("/../") || path.posix.isAbsolute(normalized)) {
    throw new ValidationError("bad_path", "That path isn't allowed.");
  }
  return normalized;
}

export function validateRepoUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ValidationError("bad_url", "That doesn't look like a valid URL.");
  }
  if (url.protocol !== "https:") {
    throw new ValidationError("bad_url", "Only https:// repository URLs are supported.");
  }
  if (url.username || url.password) {
    throw new ValidationError("bad_url", "Remove credentials from the URL.");
  }
  if (!ALLOWED_HOSTS.includes(url.hostname as (typeof ALLOWED_HOSTS)[number])) {
    throw new ValidationError("bad_url", "That repository host isn't supported.");
  }
  return url;
}

export function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true });
  if (records.length === 0 || records.some((r) => isPrivateIp(r.address))) {
    throw new ValidationError("bad_url", "That host could not be resolved to a public address.");
  }
}

export function validateLocalPath(raw: string): string {
  if (!ALLOW_LOCAL_PATHS) {
    throw new ValidationError("local_disabled", "Local repositories are not enabled.");
  }
  const resolved = path.resolve(raw);
  const root = path.resolve(LOCAL_ROOT || ".");
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new ValidationError("bad_path", "That path is outside the allowed root.");
  }
  return resolved;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add input validation and SSRF guard"
```

---

## Task 6: SQLite store

**Files:**
- Create: `src/lib/store/db.ts`, `src/lib/store/animations.ts`
- Test: `tests/lib/store.test.ts`

**Interfaces:**
- Consumes: `AnimationPayload`, `AnimationRecord` from `@/lib/types`; `MAX_PAYLOAD_BYTES` from `@/lib/constants`.
- Produces:
  - `getDb(file?: string): Database` (memoized per file; ensures schema)
  - `createAnimation(payload: AnimationPayload, db?: Database): { id: string; byteSize: number }` (gzips payload; throws `ValidationError("too_large", …)` if over cap)
  - `findAnimation(id: string, db?: Database): AnimationRecord | null`

- [ ] **Step 1: Write failing test**

`tests/lib/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createAnimation, findAnimation } from "@/lib/store/animations";
import { ensureSchema } from "@/lib/store/db";
import type { AnimationPayload } from "@/lib/types";

function payload(): AnimationPayload {
  return {
    version: 1,
    repo: { url: "https://github.com/a/b", displayName: "a/b" },
    filePath: "x.ts",
    language: "typescript",
    truncated: false,
    commits: [
      { sha: "deadbeef", shortSha: "deadbee", message: "init",
        author: { name: "A", email: "a@x" }, timestamp: "2026-01-01T00:00:00Z",
        content: "hello", status: "added" }
    ]
  };
}

describe("store", () => {
  let db: Database.Database;
  beforeEach(() => {
    db = new Database(":memory:");
    ensureSchema(db);
  });

  it("round-trips a created animation", () => {
    const { id } = createAnimation(payload(), db);
    expect(id).toHaveLength(16);
    const rec = findAnimation(id, db);
    expect(rec?.payload.commits[0].content).toBe("hello");
    expect(rec?.commitCount).toBe(1);
    expect(rec?.repoUrl).toBe("https://github.com/a/b");
  });

  it("returns null for an unknown id", () => {
    expect(findAnimation("nope", db)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/store.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/store/db.ts`:
```ts
import Database from "better-sqlite3";

let cached: Database.Database | null = null;

export function ensureSchema(db: Database.Database): Database.Database {
  db.exec(`
    CREATE TABLE IF NOT EXISTS animations (
      id TEXT PRIMARY KEY,
      repo_url TEXT,
      file_path TEXT NOT NULL,
      language TEXT NOT NULL,
      commit_count INTEGER NOT NULL,
      truncated INTEGER NOT NULL,
      byte_size INTEGER NOT NULL,
      payload BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function getDb(file = process.env.DB_FILE ?? ".data/animations.db"): Database.Database {
  if (cached) return cached;
  cached = new Database(file);
  cached.pragma("journal_mode = WAL");
  ensureSchema(cached);
  return cached;
}
```

`src/lib/store/animations.ts`:
```ts
import { gzipSync, gunzipSync } from "node:zlib";
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/store/db";
import { MAX_PAYLOAD_BYTES } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";
import type { AnimationPayload, AnimationRecord } from "@/lib/types";

interface Row {
  id: string; repo_url: string | null; file_path: string; language: string;
  commit_count: number; truncated: number; byte_size: number;
  payload: Buffer; created_at: number;
}

export function createAnimation(payload: AnimationPayload, db: Database.Database = getDb()): { id: string; byteSize: number } {
  const gz = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  if (gz.byteLength > MAX_PAYLOAD_BYTES) {
    throw new ValidationError("too_large", "This animation is too large to store.");
  }
  const id = nanoid(16);
  db.prepare(
    `INSERT INTO animations (id, repo_url, file_path, language, commit_count, truncated, byte_size, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, payload.repo.url, payload.filePath, payload.language,
    payload.commits.length, payload.truncated ? 1 : 0, gz.byteLength, gz, Date.now()
  );
  return { id, byteSize: gz.byteLength };
}

export function findAnimation(id: string, db: Database.Database = getDb()): AnimationRecord | null {
  const row = db.prepare(`SELECT * FROM animations WHERE id = ?`).get(id) as Row | undefined;
  if (!row) return null;
  const payload = JSON.parse(gunzipSync(row.payload).toString("utf8")) as AnimationPayload;
  return {
    id: row.id, repoUrl: row.repo_url, filePath: row.file_path, language: row.language,
    commitCount: row.commit_count, truncated: !!row.truncated, byteSize: row.byte_size,
    createdAt: row.created_at, payload
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add SQLite animation store"
```

---

## Task 7: Git fixture helper

**Files:**
- Create: `tests/fixtures/git.ts`
- Test: `tests/fixtures/git.test.ts`

**Interfaces:**
- Produces:
  - `interface FixtureCommit { path: string; content: string; message: string; rename?: { from: string } }`
  - `buildRepo(commits: FixtureCommit[]): Promise<string>` — returns abs path to a throwaway git repo dir with deterministic author/date.
  - `cleanupRepo(dir: string): Promise<void>`

- [ ] **Step 1: Write failing test**

`tests/fixtures/git.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildRepo, cleanupRepo } from "./git";

const run = promisify(execFile);
let dir = "";

describe("buildRepo", () => {
  afterAll(async () => { if (dir) await cleanupRepo(dir); });

  it("creates a repo with the requested commits", async () => {
    dir = await buildRepo([
      { path: "a.txt", content: "v1", message: "add a" },
      { path: "a.txt", content: "v2", message: "edit a" }
    ]);
    const { stdout } = await run("git", ["-C", dir, "log", "--oneline"]);
    expect(stdout.trim().split("\n")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fixtures/git.test.ts`
Expected: FAIL — cannot find module `./git`.

- [ ] **Step 3: Implement**

`tests/fixtures/git.ts`:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);

export interface FixtureCommit {
  path: string;
  content: string;
  message: string;
  rename?: { from: string };
}

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z"
};

export async function buildRepo(commits: FixtureCommit[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fix-repo-"));
  await run("git", ["-C", dir, "init", "-q", "-b", "main"], { env: ENV });
  for (const c of commits) {
    if (c.rename) {
      await run("git", ["-C", dir, "mv", c.rename.from, c.path], { env: ENV });
    }
    await fs.mkdir(path.dirname(path.join(dir, c.path)), { recursive: true });
    await fs.writeFile(path.join(dir, c.path), c.content);
    await run("git", ["-C", dir, "add", "-A"], { env: ENV });
    await run("git", ["-C", dir, "commit", "-q", "-m", c.message], { env: ENV });
  }
  return dir;
}

export async function cleanupRepo(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/fixtures/git.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add throwaway git repo fixture helper"
```

---

## Task 8: Git clone

**Files:**
- Create: `src/lib/git/clone.ts`
- Test: `tests/lib/git/clone.test.ts`

**Interfaces:**
- Consumes: `CLONE_TIMEOUT_MS` from `@/lib/constants`.
- Produces:
  - `cloneRepo(source: string, destDir: string): Promise<void>` — blobless, no-checkout, single-branch clone; hardened env; throws `ValidationError("clone_failed", …)` on failure.
  - `withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T>` — mkdtemp + guaranteed cleanup.

- [ ] **Step 1: Write failing test**

`tests/lib/git/clone.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cloneRepo, withTempDir } from "@/lib/git/clone";
import { buildRepo, cleanupRepo } from "../../fixtures/git";

const run = promisify(execFile);
let src = "";

describe("cloneRepo", () => {
  afterAll(async () => { if (src) await cleanupRepo(src); });

  it("clones a local source repo into a temp dir", async () => {
    src = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    await withTempDir(async (dir) => {
      await cloneRepo(src, dir);
      const { stdout } = await run("git", ["-C", dir, "rev-list", "--count", "HEAD"]);
      expect(stdout.trim()).toBe("1");
    });
  });

  it("throws on a nonexistent source", async () => {
    await withTempDir(async (dir) => {
      await expect(cloneRepo("/no/such/repo", dir)).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/git/clone.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/git/clone.ts`:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLONE_TIMEOUT_MS } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";

const run = promisify(execFile);

const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_ASKPASS: "true",
  GCM_INTERACTIVE: "never"
};

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ca-clone-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function cloneRepo(source: string, destDir: string): Promise<void> {
  try {
    await run(
      "git",
      ["clone", "--filter=blob:none", "--no-checkout", "--single-branch", source, destDir],
      { env: GIT_ENV, timeout: CLONE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (err) {
    throw new ValidationError("clone_failed", "Couldn't access that repository — is it public?");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/git/clone.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add blobless git clone into temp dir"
```

---

## Task 9: Git history

**Files:**
- Create: `src/lib/git/history.ts`
- Test: `tests/lib/git/history.test.ts`

**Interfaces:**
- Consumes: `MAX_COMMITS` from `@/lib/constants`; `CommitMeta`, `CommitStatus` from `@/lib/types`.
- Produces:
  - `getHistory(repoDir: string, filePath: string): Promise<{ commits: CommitMeta[]; truncated: boolean }>` — oldest→newest, rename-aware (`--follow`), capped to `MAX_COMMITS` most recent. Throws `ValidationError("not_found", …)` if the file has no history.

**Parsing contract:** use `git log --follow --name-status --date=iso-strict --format=%x00%H%x00%h%x00%an%x00%ae%x00%cI%x00%B%x00` so fields are NUL-delimited and each commit record ends before its name-status lines. `status` maps `A→added`, `D→deleted`, else `modified`; `pathAtCommit` is the post-rename path (last column of an `R` line, else the listed path).

- [ ] **Step 1: Write failing test**

`tests/lib/git/history.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { getHistory } from "@/lib/git/history";
import { buildRepo, cleanupRepo } from "../../fixtures/git";

const dirs: string[] = [];
afterAll(async () => { for (const d of dirs) await cleanupRepo(d); });

describe("getHistory", () => {
  it("returns commits oldest-first with metadata", async () => {
    const dir = await buildRepo([
      { path: "a.txt", content: "v1", message: "add a" },
      { path: "a.txt", content: "v2", message: "edit a" }
    ]);
    dirs.push(dir);
    const { commits, truncated } = await getHistory(dir, "a.txt");
    expect(truncated).toBe(false);
    expect(commits.map((c) => c.message.trim())).toEqual(["add a", "edit a"]);
    expect(commits[0].status).toBe("added");
    expect(commits[0].author.name).toBe("Test");
    expect(commits[0].pathAtCommit).toBe("a.txt");
  });

  it("follows renames", async () => {
    const dir = await buildRepo([
      { path: "old.txt", content: "v1", message: "add old" },
      { path: "new.txt", content: "v1", message: "rename", rename: { from: "old.txt" } }
    ]);
    dirs.push(dir);
    const { commits } = await getHistory(dir, "new.txt");
    expect(commits).toHaveLength(2);
    expect(commits[0].pathAtCommit).toBe("old.txt");
  });

  it("throws when the file has no history", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    dirs.push(dir);
    await expect(getHistory(dir, "missing.txt")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/git/history.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/git/history.ts`:
```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MAX_COMMITS } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";
import type { CommitMeta, CommitStatus } from "@/lib/types";

const run = promisify(execFile);
const SEP = " ";
const FORMAT = `${SEP}%H${SEP}%h${SEP}%an${SEP}%ae${SEP}%cI${SEP}%B${SEP}`;

function statusFor(nameStatus: string, fallbackPath: string): { status: CommitStatus; path: string } {
  const line = nameStatus.split("\n").find((l) => l.trim() !== "");
  if (!line) return { status: "modified", path: fallbackPath };
  const cols = line.split("\t");
  const code = cols[0][0];
  if (code === "A") return { status: "added", path: cols[1] ?? fallbackPath };
  if (code === "D") return { status: "deleted", path: cols[1] ?? fallbackPath };
  if (code === "R") return { status: "modified", path: cols[2] ?? fallbackPath };
  return { status: "modified", path: cols[1] ?? fallbackPath };
}

export async function getHistory(
  repoDir: string,
  filePath: string
): Promise<{ commits: CommitMeta[]; truncated: boolean }> {
  const { stdout } = await run(
    "git",
    ["-C", repoDir, "log", "--follow", "--name-status", `--format=${FORMAT}`, "--", filePath],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  const records = stdout.split(SEP + "\n").filter((r) => r.includes(SEP));
  // Each record begins with a leading SEP from FORMAT; split on SEP yields:
  // ["", H, h, an, ae, cI, B, nameStatus]
  const commits: CommitMeta[] = [];
  for (const raw of stdout.split(new RegExp(`(?=${SEP}[0-9a-f]{40}${SEP})`)).filter(Boolean)) {
    const parts = raw.split(SEP);
    if (parts.length < 8) continue;
    const [, sha, shortSha, an, ae, cI, body] = parts;
    const nameStatus = parts.slice(7).join(SEP);
    const { status, path } = statusFor(nameStatus, filePath);
    commits.push({
      sha, shortSha, message: body, author: { name: an, email: ae },
      timestamp: cI, pathAtCommit: path, status
    });
  }
  if (commits.length === 0) {
    throw new ValidationError("not_found", "That path doesn't exist in this repository.");
  }
  commits.reverse(); // git log is newest-first; we want oldest-first
  const truncated = commits.length > MAX_COMMITS;
  return { commits: truncated ? commits.slice(commits.length - MAX_COMMITS) : commits, truncated };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/git/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add rename-aware git history extraction"
```

---

## Task 10: Git snapshot

**Files:**
- Create: `src/lib/git/snapshot.ts`
- Test: `tests/lib/git/snapshot.test.ts`

**Interfaces:**
- Consumes: `MAX_FILE_BYTES` from `@/lib/constants`.
- Produces:
  - `isBinary(buf: Buffer): boolean` (null-byte heuristic in first 8000 bytes)
  - `getFileAt(repoDir: string, sha: string, filePath: string): Promise<string>` — content via `git show`; throws `ValidationError("binary", …)` if binary, `ValidationError("too_large", …)` if over `MAX_FILE_BYTES`; returns `""` if the blob is absent (e.g. deletion commit).

- [ ] **Step 1: Write failing test**

`tests/lib/git/snapshot.test.ts`:
```ts
import { describe, it, expect, afterAll } from "vitest";
import { getFileAt, isBinary } from "@/lib/git/snapshot";
import { getHistory } from "@/lib/git/history";
import { buildRepo, cleanupRepo } from "../../fixtures/git";

const dirs: string[] = [];
afterAll(async () => { for (const d of dirs) await cleanupRepo(d); });

describe("isBinary", () => {
  it("detects null bytes", () => {
    expect(isBinary(Buffer.from([1, 2, 0, 3]))).toBe(true);
    expect(isBinary(Buffer.from("plain text"))).toBe(false);
  });
});

describe("getFileAt", () => {
  it("returns file content at a given commit", async () => {
    const dir = await buildRepo([
      { path: "a.txt", content: "v1", message: "add" },
      { path: "a.txt", content: "v2", message: "edit" }
    ]);
    dirs.push(dir);
    const { commits } = await getHistory(dir, "a.txt");
    const first = await getFileAt(dir, commits[0].sha, commits[0].pathAtCommit);
    expect(first).toBe("v1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/git/snapshot.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/git/snapshot.ts`:
```ts
import { execFile } from "node:child_process";
import { MAX_FILE_BYTES } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";

export function isBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i++) if (buf[i] === 0) return true;
  return false;
}

export function getFileAt(repoDir: string, sha: string, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      ["-C", repoDir, "show", `${sha}:${filePath}`],
      { encoding: "buffer", maxBuffer: MAX_FILE_BYTES * 2 },
      (err, stdout) => {
        if (err) {
          // Path absent at this commit (e.g. deletion). Treat as empty content.
          resolve("");
          return;
        }
        const buf = stdout as Buffer;
        if (buf.byteLength > MAX_FILE_BYTES) {
          reject(new ValidationError("too_large", "That file is too large to animate (max 256 KB)."));
          return;
        }
        if (isBinary(buf)) {
          reject(new ValidationError("binary", "That looks like a binary file — only text/code files are supported."));
          return;
        }
        resolve(buf.toString("utf8"));
      }
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/git/snapshot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add git file snapshot with binary/size guards"
```

---

## Task 11: Extraction orchestrator

**Files:**
- Create: `src/lib/extract.ts`
- Test: `tests/lib/extract.test.ts`

**Interfaces:**
- Consumes: `validateFilePath`, `validateRepoUrl`, `assertPublicHost`, `validateLocalPath` from `@/lib/validate`; `cloneRepo`, `withTempDir`; `getHistory`; `getFileAt`; `detectLanguage`; `ALLOW_LOCAL_PATHS`; `AnimationPayload` from `@/lib/types`.
- Produces:
  - `type Progress = { phase: "cloning" } | { phase: "history" } | { phase: "snapshots"; current: number; total: number }`
  - `interface ExtractInput { repoInput: string; filePath: string }`
  - `extractAnimation(input: ExtractInput, onProgress?: (p: Progress) => void): Promise<AnimationPayload>`

**Behavior:** A `repoInput` that parses as an allowlisted https URL goes through `validateRepoUrl` + `assertPublicHost` and is cloned by URL. Otherwise, if `ALLOW_LOCAL_PATHS`, it is treated as a local path (`validateLocalPath`) and cloned from disk. `displayName` is `owner/repo` for URLs (last two path segments, trailing `.git` stripped) or the basename for local paths; `repo.url` is the URL string or `null` for local.

- [ ] **Step 1: Write failing test**

`tests/lib/extract.test.ts`:
```ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { extractAnimation } from "@/lib/extract";
import { buildRepo, cleanupRepo } from "../fixtures/git";

// Local-path mode must be enabled for fixture-based extraction.
beforeAll(() => { process.env.ALLOW_LOCAL_PATHS = "1"; });

const dirs: string[] = [];
afterAll(async () => { for (const d of dirs) await cleanupRepo(d); });

describe("extractAnimation (local mode)", () => {
  it("builds a payload with one snapshot per commit and reports progress", async () => {
    const dir = await buildRepo([
      { path: "a.txt", content: "line1", message: "add a" },
      { path: "a.txt", content: "line1\nline2", message: "edit a" }
    ]);
    dirs.push(dir);
    process.env.LOCAL_ROOT = dir;

    const phases: string[] = [];
    const payload = await extractAnimation(
      { repoInput: dir, filePath: "a.txt" },
      (p) => phases.push(p.phase)
    );

    expect(payload.version).toBe(1);
    expect(payload.repo.url).toBeNull();
    expect(payload.commits.map((c) => c.content)).toEqual(["line1", "line1\nline2"]);
    expect(payload.language).toBe("plaintext");
    expect(phases).toContain("cloning");
    expect(phases).toContain("snapshots");
  });
});
```

> Note: `validateLocalPath` reads `ALLOW_LOCAL_PATHS`/`LOCAL_ROOT` at call time via `@/lib/constants`. Because constants are evaluated at import, this test sets `LOCAL_ROOT` before the call and relies on `extractAnimation` re-reading `process.env` for the local branch (see implementation: it checks `process.env.ALLOW_LOCAL_PATHS` directly).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/extract.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/lib/extract.ts`:
```ts
import path from "node:path";
import { validateFilePath, validateRepoUrl, assertPublicHost, ValidationError } from "@/lib/validate";
import { cloneRepo, withTempDir } from "@/lib/git/clone";
import { getHistory } from "@/lib/git/history";
import { getFileAt } from "@/lib/git/snapshot";
import { detectLanguage } from "@/lib/language";
import type { AnimationPayload, CommitSnapshot } from "@/lib/types";

export type Progress =
  | { phase: "cloning" }
  | { phase: "history" }
  | { phase: "snapshots"; current: number; total: number };

export interface ExtractInput {
  repoInput: string;
  filePath: string;
}

function displayNameFromUrl(url: URL): string {
  const segs = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  return segs.slice(-2).join("/") || url.hostname;
}

async function resolveSource(repoInput: string): Promise<{ source: string; url: string | null; displayName: string }> {
  let url: URL | null = null;
  try { url = validateRepoUrl(repoInput); } catch (e) {
    if (process.env.ALLOW_LOCAL_PATHS === "1") {
      const resolved = path.resolve(repoInput);
      const root = path.resolve(process.env.LOCAL_ROOT || ".");
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new ValidationError("bad_path", "That path is outside the allowed root.");
      }
      return { source: resolved, url: null, displayName: path.basename(resolved) };
    }
    throw e;
  }
  await assertPublicHost(url.hostname);
  return { source: url.toString(), url: url.toString(), displayName: displayNameFromUrl(url) };
}

export async function extractAnimation(
  input: ExtractInput,
  onProgress: (p: Progress) => void = () => {}
): Promise<AnimationPayload> {
  const filePath = validateFilePath(input.filePath);
  const { source, url, displayName } = await resolveSource(input.repoInput);

  return withTempDir(async (dir) => {
    onProgress({ phase: "cloning" });
    await cloneRepo(source, dir);

    onProgress({ phase: "history" });
    const { commits, truncated } = await getHistory(dir, filePath);

    const snapshots: CommitSnapshot[] = [];
    for (let i = 0; i < commits.length; i++) {
      onProgress({ phase: "snapshots", current: i + 1, total: commits.length });
      const c = commits[i];
      const content = await getFileAt(dir, c.sha, c.pathAtCommit);
      snapshots.push({
        sha: c.sha, shortSha: c.shortSha, message: c.message,
        author: c.author, timestamp: c.timestamp, content, status: c.status
      });
    }

    return {
      version: 1,
      repo: { url, displayName },
      filePath,
      language: detectLanguage(filePath),
      truncated,
      commits: snapshots
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add extraction orchestrator"
```

---

## Task 12: GET animation API route

**Files:**
- Create: `src/app/api/animations/[id]/route.ts`
- Test: `tests/api/get-animation.test.ts`

**Interfaces:**
- Consumes: `findAnimation` from `@/lib/store/animations`.
- Produces: `GET(req, ctx)` returning `200` `{ payload, meta }` or `404` `{ error }`.

- [ ] **Step 1: Write failing test**

`tests/api/get-animation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/store/db";
import { createAnimation } from "@/lib/store/animations";
import { GET } from "@/app/api/animations/[id]/route";
import type { AnimationPayload } from "@/lib/types";

const db = ensureSchema(new Database(":memory:"));

const payload: AnimationPayload = {
  version: 1, repo: { url: null, displayName: "x" }, filePath: "a.txt",
  language: "plaintext", truncated: false,
  commits: [{ sha: "s", shortSha: "s", message: "m", author: { name: "n", email: "e" },
    timestamp: "2026-01-01T00:00:00Z", content: "hi", status: "added" }]
};

describe("GET /api/animations/:id", () => {
  it("returns 404 for unknown id", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }), db });
    expect(res.status).toBe(404);
  });

  it("returns the payload for a known id", async () => {
    const { id } = createAnimation(payload, db);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id }), db });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.commits[0].content).toBe("hi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/get-animation.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/app/api/animations/[id]/route.ts`:
```ts
import type Database from "better-sqlite3";
import { findAnimation } from "@/lib/store/animations";

interface Ctx {
  params: Promise<{ id: string }>;
  db?: Database.Database; // test injection only
}

export async function GET(_req: Request, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  const rec = findAnimation(id, ctx.db);
  if (!rec) {
    return Response.json({ error: "Animation not found." }, { status: 404 });
  }
  return Response.json({
    payload: rec.payload,
    meta: { id: rec.id, createdAt: rec.createdAt, commitCount: rec.commitCount, truncated: rec.truncated }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/get-animation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add GET animation API route"
```

---

## Task 13: POST animation API route (SSE)

**Files:**
- Create: `src/app/api/animations/route.ts`
- Test: `tests/api/post-animation.test.ts`

**Interfaces:**
- Consumes: `extractAnimation`, `createAnimation`, `ValidationError`.
- Produces: `POST(req)` — reads `{ repoInput, filePath }` JSON, streams `text/event-stream` events: `progress` (one per `onProgress`), then `done` `{ id }`, or `error` `{ message, code }`. Always returns `200` (errors are SSE events, not HTTP status) so the stream can carry the message.

- [ ] **Step 1: Write failing test**

`tests/api/post-animation.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { buildRepo } from "../fixtures/git";
import { POST } from "@/app/api/animations/route";

beforeAll(() => { process.env.ALLOW_LOCAL_PATHS = "1"; });

async function readSse(res: Response): Promise<string[]> {
  const text = await res.text();
  return text.split("\n\n").filter((b) => b.trim() !== "");
}

describe("POST /api/animations", () => {
  it("streams progress then a done event with an id", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.LOCAL_ROOT = dir;
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ repoInput: dir, filePath: "a.txt" })
    });
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readSse(res);
    const joined = events.join("\n");
    expect(joined).toContain("event: done");
    expect(joined).toMatch(/"id":"[A-Za-z0-9_-]{16}"/);
  });

  it("streams an error event for a disallowed repo", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ repoInput: "https://evil.com/a/b", filePath: "a.txt" })
    });
    const res = await POST(req);
    const joined = (await readSse(res)).join("\n");
    expect(joined).toContain("event: error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/post-animation.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/app/api/animations/route.ts`:
```ts
import { extractAnimation, type Progress } from "@/lib/extract";
import { createAnimation } from "@/lib/store/animations";
import { ValidationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request): Promise<Response> {
  const { repoInput, filePath } = (await req.json()) as { repoInput?: string; filePath?: string };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(sse(event, data)));
      try {
        if (!repoInput || !filePath) {
          throw new ValidationError("bad_input", "Repository and file path are required.");
        }
        const onProgress = (p: Progress) => send("progress", p);
        const payload = await extractAnimation({ repoInput, filePath }, onProgress);
        const { id } = createAnimation(payload);
        send("done", { id });
      } catch (err) {
        const code = err instanceof ValidationError ? err.code : "internal";
        const message = err instanceof ValidationError ? err.message : "Something went wrong.";
        if (!(err instanceof ValidationError)) console.error("extract failed:", err);
        send("error", { message, code });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/post-animation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add POST animation API route with SSE progress"
```

---

## Task 14: Playback state hook

**Files:**
- Create: `src/components/usePlayer.ts`
- Test: `tests/components/usePlayer.test.ts`

**Interfaces:**
- Consumes: `BASE_DWELL_MS` from `@/lib/constants`.
- Produces:
  - `interface PlayerApi { index: number; isPlaying: boolean; speed: number; play(): void; pause(): void; toggle(): void; next(): void; prev(): void; seek(i: number): void; setSpeed(s: number): void }`
  - `usePlayer(count: number): PlayerApi` — auto-advances every `BASE_DWELL_MS / speed` ms while playing; stops at the last index; `seek` clamps to `[0, count-1]`.

- [ ] **Step 1: Write failing test**

`tests/components/usePlayer.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePlayer } from "@/components/usePlayer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("usePlayer", () => {
  it("advances while playing and stops at the end", () => {
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.play());
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.index).toBe(1);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.index).toBe(2);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current.index).toBe(2);
    expect(result.current.isPlaying).toBe(false);
  });

  it("clamps seek and steps", () => {
    const { result } = renderHook(() => usePlayer(3));
    act(() => result.current.seek(99));
    expect(result.current.index).toBe(2);
    act(() => result.current.prev());
    expect(result.current.index).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/usePlayer.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/usePlayer.ts`:
```ts
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_DWELL_MS } from "@/lib/constants";

export interface PlayerApi {
  index: number; isPlaying: boolean; speed: number;
  play(): void; pause(): void; toggle(): void;
  next(): void; prev(): void; seek(i: number): void; setSpeed(s: number): void;
}

export function usePlayer(count: number): PlayerApi {
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = Math.max(0, count - 1);
  const clamp = useCallback((i: number) => Math.min(last, Math.max(0, i)), [last]);

  const play = useCallback(() => { if (count > 1) setPlaying(true); }, [count]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  const seek = useCallback((i: number) => setIndex(clamp(i)), [clamp]);

  const idxRef = useRef(index);
  idxRef.current = index;

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const nextIdx = idxRef.current + 1;
      if (nextIdx > last) { setPlaying(false); return; }
      setIndex(nextIdx);
    }, BASE_DWELL_MS / speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, last]);

  return { index, isPlaying, speed, play, pause, toggle, next, prev, seek, setSpeed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/usePlayer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add playback state hook"
```

---

## Task 15: Presentational player components

**Files:**
- Create: `src/components/CommitInfo.tsx`, `src/components/Controls.tsx`, `src/components/Timeline.tsx`
- Test: `tests/components/controls.test.tsx`

**Interfaces:**
- Consumes: `CommitSnapshot` from `@/lib/types`; `PlayerApi` shape.
- Produces:
  - `CommitInfo({ commit, index, count }: { commit: CommitSnapshot; index: number; count: number })`
  - `Controls({ player }: { player: PlayerApi })`
  - `Timeline({ index, count, onSeek }: { index: number; count: number; onSeek: (i: number) => void })`

- [ ] **Step 1: Write failing test**

`tests/components/controls.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "@/components/Controls";
import { CommitInfo } from "@/components/CommitInfo";

function api(overrides = {}) {
  return {
    index: 0, isPlaying: false, speed: 1,
    play: vi.fn(), pause: vi.fn(), toggle: vi.fn(),
    next: vi.fn(), prev: vi.fn(), seek: vi.fn(), setSpeed: vi.fn(),
    ...overrides
  };
}

describe("Controls", () => {
  it("calls toggle when play/pause is clicked", async () => {
    const player = api();
    render(<Controls player={player} />);
    await userEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(player.toggle).toHaveBeenCalled();
  });
});

describe("CommitInfo", () => {
  it("shows the first line of the message and position", () => {
    render(
      <CommitInfo
        index={2} count={5}
        commit={{ sha: "s", shortSha: "abc1234", message: "Fix bug\n\ndetails",
          author: { name: "Dev", email: "d@x" }, timestamp: "2026-01-01T00:00:00Z",
          content: "", status: "modified" }}
      />
    );
    expect(screen.getByText("Fix bug")).toBeTruthy();
    expect(screen.getByText("abc1234")).toBeTruthy();
    expect(screen.getByText("3 / 5")).toBeTruthy();
  });
});
```

> Add `import "@testing-library/jest-dom/vitest"` only if matchers like `toBeInTheDocument` are used; the assertions above use truthiness and need no extra setup.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/controls.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/CommitInfo.tsx`:
```tsx
import type { CommitSnapshot } from "@/lib/types";

export function CommitInfo({ commit, index, count }: { commit: CommitSnapshot; index: number; count: number }) {
  const firstLine = commit.message.split("\n")[0];
  const when = new Date(commit.timestamp);
  return (
    <div className="commit-info" style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
      <code>{commit.shortSha}</code>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstLine}</span>
      <span>{commit.author.name}</span>
      <time dateTime={commit.timestamp} title={when.toISOString()}>{when.toLocaleDateString()}</time>
      <span>{index + 1} / {count}</span>
    </div>
  );
}
```

`src/components/Controls.tsx`:
```tsx
"use client";
import type { PlayerApi } from "@/components/usePlayer";

const SPEEDS = [0.5, 1, 2, 4];

export function Controls({ player }: { player: PlayerApi }) {
  return (
    <div className="controls" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={player.prev} aria-label="Previous commit">⏮</button>
      <button onClick={player.toggle} aria-label={player.isPlaying ? "Pause" : "Play"}>
        {player.isPlaying ? "⏸" : "▶"}
      </button>
      <button onClick={player.next} aria-label="Next commit">⏭</button>
      <label style={{ marginLeft: "auto" }}>
        Speed
        <select
          aria-label="Speed"
          value={player.speed}
          onChange={(e) => player.setSpeed(Number(e.target.value))}
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
```

`src/components/Timeline.tsx`:
```tsx
"use client";

export function Timeline({ index, count, onSeek }: { index: number; count: number; onSeek: (i: number) => void }) {
  return (
    <input
      type="range"
      aria-label="Timeline"
      min={0}
      max={Math.max(0, count - 1)}
      value={index}
      onChange={(e) => onSeek(Number(e.target.value))}
      style={{ width: "100%" }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/controls.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add presentational player components"
```

---

## Task 16: Code viewport (morph)

**Files:**
- Create: `src/components/CodeViewport.tsx`
- Test: `tests/components/codeViewport.test.tsx`

**Interfaces:**
- Consumes: `toRenderLines` from `@/lib/diff`.
- Produces: `CodeViewport({ content, prevContent }: { content: string; prevContent: string | null })` — renders one keyed `motion.div` per line with `layout`, enter/exit animations, and `data-change` attributes; respects `prefers-reduced-motion`.

- [ ] **Step 1: Write failing test**

`tests/components/codeViewport.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CodeViewport } from "@/components/CodeViewport";

describe("CodeViewport", () => {
  it("renders one row per line with change annotations", () => {
    const { container } = render(<CodeViewport content={"a\nb\nc"} prevContent={"a\nc"} />);
    const rows = container.querySelectorAll("[data-line]");
    expect(rows).toHaveLength(3);
    const added = container.querySelectorAll('[data-change="add"]');
    expect(added).toHaveLength(1); // "b" is new
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/codeViewport.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/CodeViewport.tsx`:
```tsx
"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toRenderLines } from "@/lib/diff";

export function CodeViewport({ content, prevContent }: { content: string; prevContent: string | null }) {
  const reduce = useReducedMotion();
  const lines = toRenderLines(content, prevContent);

  return (
    <div
      className="code-viewport"
      style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: "20px", overflow: "auto" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line, i) => (
          <motion.div
            key={line.key}
            data-line
            data-change={line.change}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, height: 0, backgroundColor: "rgba(46,160,67,0.25)" }}
            animate={{ opacity: 1, height: 20, backgroundColor: "rgba(0,0,0,0)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, backgroundColor: "rgba(248,81,73,0.25)" }}
            transition={{ duration: reduce ? 0.1 : 0.4 }}
            style={{ display: "flex", gap: 12, whiteSpace: "pre" }}
          >
            <span style={{ opacity: 0.4, userSelect: "none", minWidth: 32, textAlign: "right" }}>{i + 1}</span>
            <span>{line.text === "" ? " " : line.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/codeViewport.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add morphing code viewport"
```

---

## Task 17: Player container + player page

**Files:**
- Create: `src/components/Player.tsx`, `src/app/a/[id]/page.tsx`, `src/app/a/[id]/not-found.tsx`
- Test: `tests/components/player.test.tsx`

**Interfaces:**
- Consumes: `usePlayer`, `CodeViewport`, `CommitInfo`, `Controls`, `Timeline`; `AnimationPayload`; `findAnimation`.
- Produces:
  - `Player({ payload }: { payload: AnimationPayload })` (client)
  - default-exported async `PlayerPage` server component for `/a/[id]` that loads the record and renders `<Player>` or triggers `notFound()`.

- [ ] **Step 1: Write failing test**

`tests/components/player.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Player } from "@/components/Player";
import type { AnimationPayload } from "@/lib/types";

const payload: AnimationPayload = {
  version: 1, repo: { url: null, displayName: "a/b" }, filePath: "a.txt",
  language: "plaintext", truncated: false,
  commits: [
    { sha: "1", shortSha: "1111111", message: "first", author: { name: "D", email: "d@x" },
      timestamp: "2026-01-01T00:00:00Z", content: "a", status: "added" },
    { sha: "2", shortSha: "2222222", message: "second", author: { name: "D", email: "d@x" },
      timestamp: "2026-01-02T00:00:00Z", content: "a\nb", status: "modified" }
  ]
};

describe("Player", () => {
  it("renders the first commit and the timeline", () => {
    render(<Player payload={payload} />);
    expect(screen.getByText("first")).toBeTruthy();
    expect(screen.getByText("1 / 2")).toBeTruthy();
    expect(screen.getByRole("slider", { name: /timeline/i })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/player.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/Player.tsx`:
```tsx
"use client";
import { usePlayer } from "@/components/usePlayer";
import { CodeViewport } from "@/components/CodeViewport";
import { CommitInfo } from "@/components/CommitInfo";
import { Controls } from "@/components/Controls";
import { Timeline } from "@/components/Timeline";
import type { AnimationPayload } from "@/lib/types";

export function Player({ payload }: { payload: AnimationPayload }) {
  const { commits } = payload;
  const player = usePlayer(commits.length);
  const current = commits[player.index];
  const prev = player.index > 0 ? commits[player.index - 1].content : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100vh", padding: 16, boxSizing: "border-box" }}>
      <header style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{payload.repo.displayName} · {payload.filePath}{payload.truncated ? " · (truncated)" : ""}</span>
        <a href="/create">Create your own</a>
      </header>
      <CommitInfo commit={current} index={player.index} count={commits.length} />
      <div style={{ flex: 1, minHeight: 0, border: "1px solid #ddd", borderRadius: 6 }}>
        <CodeViewport content={current.content} prevContent={prev} />
      </div>
      <Timeline index={player.index} count={commits.length} onSeek={player.seek} />
      <Controls player={player} />
    </div>
  );
}
```

`src/app/a/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { findAnimation } from "@/lib/store/animations";
import { Player } from "@/components/Player";

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = findAnimation(id);
  if (!rec) notFound();
  return <Player payload={rec.payload} />;
}
```

`src/app/a/[id]/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Animation not found</h1>
      <p>This link may be incorrect. <a href="/create">Create a new animation</a>.</p>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/player.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add player container and player page"
```

---

## Task 18: Create form + page

**Files:**
- Create: `src/components/CreateForm.tsx`, `src/app/create/page.tsx`
- Test: `tests/components/createForm.test.tsx`

**Interfaces:**
- Produces: `CreateForm()` (client) — two inputs (`repoInput`, `filePath`), submit posts to `/api/animations`, parses the SSE stream, shows phase text, and on `done` navigates to `/a/<id>`; on `error` shows the message.

**Note:** SSE parsing reads the `fetch` response body as a stream and splits on `\n\n`. The test mocks `fetch` to return a `ReadableStream` and a stubbed `next/navigation` `useRouter`.

- [ ] **Step 1: Write failing test**

`tests/components/createForm.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CreateForm } from "@/components/CreateForm";

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) { for (const e of events) c.enqueue(enc.encode(e)); c.close(); }
  });
}

beforeEach(() => { push.mockReset(); });

describe("CreateForm", () => {
  it("navigates to the animation on done", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      sseStream([
        "event: progress\ndata: {\"phase\":\"cloning\"}\n\n",
        "event: done\ndata: {\"id\":\"abcdefghijklmnop\"}\n\n"
      ]),
      { headers: { "content-type": "text/event-stream" } }
    )));

    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/repository/i), "https://github.com/a/b");
    await userEvent.type(screen.getByLabelText(/file path/i), "src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/createForm.test.tsx`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/CreateForm.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface SseEvent { event: string; data: unknown }

function parseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const blocks = buffer.split("\n\n");
  const rest = blocks.pop() ?? "";
  const events: SseEvent[] = [];
  for (const block of blocks) {
    const evLine = block.split("\n").find((l) => l.startsWith("event: "));
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (evLine && dataLine) {
      events.push({ event: evLine.slice(7), data: JSON.parse(dataLine.slice(6)) });
    }
  }
  return { events, rest };
}

export function CreateForm() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setStatus("Starting…");
    const res = await fetch("/api/animations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repoInput, filePath })
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      const { events, rest } = parseChunk(buffer);
      buffer = rest;
      for (const ev of events) {
        if (ev.event === "progress") {
          const p = ev.data as { phase: string; current?: number; total?: number };
          setStatus(
            p.phase === "snapshots" ? `Extracting ${p.current}/${p.total}…`
            : p.phase === "cloning" ? "Cloning…" : "Reading history…"
          );
        } else if (ev.event === "done") {
          router.push(`/a/${(ev.data as { id: string }).id}`);
          return;
        } else if (ev.event === "error") {
          setError((ev.data as { message: string }).message);
          setBusy(false); setStatus(null);
        }
      }
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "10vh auto", padding: 16 }}>
      <h1>Animate a file's history</h1>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Repository URL
          <input value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
            placeholder="https://github.com/owner/repo" required style={{ width: "100%" }} />
        </label>
        <label>File path
          <input value={filePath} onChange={(e) => setFilePath(e.target.value)}
            placeholder="src/index.ts" required style={{ width: "100%" }} />
        </label>
        <button type="submit" disabled={busy}>Animate</button>
      </form>
      {status && <p>{status}</p>}
      {error && <p role="alert" style={{ color: "#b00" }}>{error}</p>}
    </main>
  );
}
```

`src/app/create/page.tsx`:
```tsx
import { CreateForm } from "@/components/CreateForm";

export default function CreatePage() {
  return <CreateForm />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/createForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add create form with SSE progress"
```

---

## Task 19: End-to-end flow (Playwright)

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/flow.spec.ts`, `tests/e2e/fixture-repo.setup.ts`
- Modify: `package.json` (add `e2e` already present; ensure Playwright installed)

**Interfaces:**
- Consumes: the running app in local-path mode (`ALLOW_LOCAL_PATHS=1`, `LOCAL_ROOT` pointing at a generated fixture repo).
- Produces: a green E2E run covering create → redirect → play → scrub.

- [ ] **Step 1: Write the Playwright config + setup (failing because no test yet)**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000/create",
    timeout: 120000,
    env: {
      ALLOW_LOCAL_PATHS: "1",
      LOCAL_ROOT: process.env.E2E_LOCAL_ROOT ?? "/tmp",
      DB_FILE: ".data/e2e.db"
    }
  },
  use: { baseURL: "http://localhost:3000" }
});
```

`tests/e2e/fixture-repo.setup.ts`:
```ts
import { test as setup } from "@playwright/test";
import { buildRepo } from "../fixtures/git";
import { promises as fs } from "node:fs";

setup("create fixture repo", async () => {
  const dir = await buildRepo([
    { path: "demo.txt", content: "hello", message: "add demo" },
    { path: "demo.txt", content: "hello\nworld", message: "extend demo" }
  ]);
  await fs.writeFile(".data/e2e-repo-path", dir);
});
```

- [ ] **Step 2: Write the failing E2E test**

`tests/e2e/flow.spec.ts`:
```ts
import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";

test("create and play an animation", async ({ page }) => {
  const repoDir = (await fs.readFile(".data/e2e-repo-path", "utf8")).trim();

  await page.goto("/create");
  await page.getByLabel(/repository/i).fill(repoDir);
  await page.getByLabel(/file path/i).fill("demo.txt");
  await page.getByRole("button", { name: /animate/i }).click();

  await page.waitForURL(/\/a\/.+/, { timeout: 60000 });
  await expect(page.getByText("1 / 2")).toBeVisible();

  await page.getByRole("button", { name: /play/i }).click();
  await expect(page.getByText("2 / 2")).toBeVisible({ timeout: 10000 });
});
```

> The fixture repo path is used as `repoInput`; set `E2E_LOCAL_ROOT` to the repo's parent dir (or `/tmp`, which covers `mkdtemp`) so `validateLocalPath` accepts it.

- [ ] **Step 3: Run to verify it fails, then make it pass**

Run: `npx playwright install --with-deps chromium && mkdir -p .data && E2E_LOCAL_ROOT=/tmp npx playwright test tests/e2e/fixture-repo.setup.ts tests/e2e/flow.spec.ts`
Expected first run: may FAIL if `.data/e2e-repo-path` ordering is wrong. Ensure the setup project runs first by adding to `playwright.config.ts` `projects`:
```ts
  projects: [
    { name: "setup", testMatch: /fixture-repo\.setup\.ts/ },
    { name: "e2e", dependencies: ["setup"], testMatch: /flow\.spec\.ts/ }
  ],
```
Re-run: `E2E_LOCAL_ROOT=/tmp npx playwright test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: add end-to-end create-and-play flow"
```

---

## Task 20: Dockerfile + deployment

**Files:**
- Create: `Dockerfile`, `.dockerignore`
- Modify: `next.config.mjs` (enable standalone output)

**Interfaces:**
- Produces: a runnable container image with the `git` binary and a persistent volume mount point for the SQLite DB.

- [ ] **Step 1: Enable standalone output**

Edit `next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"]
};
export default nextConfig;
```

- [ ] **Step 2: Create `.dockerignore`**

```
node_modules
.next
.git
.data
test-results
playwright-report
*.db
```

- [ ] **Step 3: Create `Dockerfile`**

```dockerfile
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
RUN mkdir -p /app/.data
VOLUME ["/app/.data"]
ENV DB_FILE=/app/.data/animations.db
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Build the image to verify**

Run: `docker build -t commit-animation .`
Expected: build succeeds; final image contains `git` (verify: `docker run --rm commit-animation git --version`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add Docker build for deployment"
```

---

## Self-Review

**Spec coverage:**
- Hosted, deployable service → Task 20 (Docker, standalone).
- Public URLs + local self-host → Tasks 5, 11 (`validateRepoUrl`/`assertPublicHost` vs `ALLOW_LOCAL_PATHS`).
- Stored snapshot + link-possession ID → Task 6 (`nanoid(16)`, gzipped payload).
- Full history capped at 100 + `truncated` → Task 9.
- Line-level diff morph (FLIP) + reduced-motion fallback → Tasks 4, 16.
- Syntax highlighting deferred; `language` field present → Tasks 2, 3.
- Blobless/no-checkout clone, rename-aware history, `git show` snapshots → Tasks 8, 9, 10.
- Security: no-shell, URL allowlist, SSRF, path traversal, caps, temp-dir cleanup, local-mode gating → Tasks 5, 8, 10, 11.
- SSE progress create flow + GET playback → Tasks 12, 13, 18.
- UI: header, commit info, code viewport, timeline, controls → Tasks 15, 16, 17.
- Error handling messages → surfaced via `ValidationError` codes (Tasks 5–11) and rendered in Tasks 17, 18.
- Tests at every layer incl. explicit security cases + E2E → Tasks 5–19.

**Placeholder scan:** none — every code step contains full code; no TODO/TBD.

**Type consistency:** `AnimationPayload`/`CommitSnapshot`/`CommitMeta` (Task 2) used consistently in Tasks 6, 9, 10, 11, 12, 17. `PlayerApi` (Task 14) consumed by Tasks 15, 17. `Progress`/`ExtractInput` (Task 11) consumed by Task 13. `ValidationError` (Task 5) thrown/handled consistently. `toRenderLines`/`toKeys` (Task 4) consumed by Task 16.

> One known integration nuance to watch during execution: `better-sqlite3` is a native module — Task 1 installs build tooling locally and Task 20's `deps` stage installs `python3/make/g++` for `npm ci`. If the local dev machine lacks build tools, install them before Task 6.
