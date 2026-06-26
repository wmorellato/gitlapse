# Single-Input Create Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the create flow accept a single input — a remote file URL or (when enabled) an absolute local file path — and infer `{ repoInput, filePath }` on the server, keeping the two-field form as a fallback.

**Architecture:** A new pure-ish module `src/lib/source.ts` exposes `resolveInput(raw)`, which classifies the string and returns the `{ repoInput, filePath }` pair the existing `extractAnimation` already consumes. Remote URLs are parsed per-host into repo + path (ref discarded); local absolute paths are resolved to their enclosing git repo via `git rev-parse --show-toplevel`. The API route calls `resolveInput` when given `{ input }` and otherwise behaves exactly as today. All existing validation (host allowlist, SSRF, traversal, `LOCAL_ROOT` containment) is reused unchanged downstream.

**Tech Stack:** Next.js 15 (App Router) route handler, React 19, TypeScript, `node:child_process` git, Vitest + Testing Library, Playwright.

## Global Constraints

- Node `>= 20`; TypeScript; avoid `any`.
- Allowlisted hosts (exact): `github.com`, `gitlab.com`, `bitbucket.org`, `codeberg.org` (from `ALLOWED_HOSTS` in `src/lib/constants.ts`).
- `resolveInput` must NOT bypass existing validation: it only produces a `{ repoInput, filePath }` pair; the host allowlist + SSRF (`assertPublicHost`) + traversal (`validateFilePath`) checks still run downstream in `resolveSource`/`extractAnimation`.
- Local paths are gated by `process.env.ALLOW_LOCAL_PATHS === "1"` and must stay inside `LOCAL_ROOT` (reuse `validateLocalPath`).
- v1 parses any branch/ref/commit in a URL and **silently discards it** — extraction uses the default branch. No UI note, no signal threaded through the API.
- Error codes are stable `ValidationError` codes: new — `need_file`, `not_a_file_url`, `unrecognized_input`, `no_repo_found`; reused — `bad_path`, `local_disabled`, `bad_input`.
- Tests use Vitest globals; assert with `.toEqual`/`.toBe`/`.rejects.toMatchObject`/`.toThrow` — this repo does NOT use jest-dom matchers. Component tests use `@testing-library/react` + `@testing-library/user-event`.
- Path alias `@` → `src`.
- Conventional-commit messages.

---

### Task 1: Remote file-URL parser

**Files:**
- Create: `src/lib/source.ts`
- Test: `tests/lib/source.test.ts`

**Interfaces:**
- Consumes: `ValidationError` from `@/lib/validate`.
- Produces: `parseRemoteFileUrl(url: URL): { repoInput: string; filePath: string }` — given a URL whose hostname is one of the four allowlisted hosts, returns the repo base (`https://host/owner/repo`, trailing `.git` stripped) and the in-repo file path (ref segment discarded; path segments URL-decoded). Throws `ValidationError` with code `need_file` (bare repo URL) or `not_a_file_url` (allowlisted host, not a file link).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/source.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseRemoteFileUrl } from "@/lib/source";

function code(fn: () => unknown): string {
  try { fn(); } catch (e) { return (e as { code: string }).code; }
  throw new Error("expected throw");
}

describe("parseRemoteFileUrl", () => {
  it("parses a GitHub blob URL", () => {
    expect(parseRemoteFileUrl(new URL("https://github.com/owner/repo/blob/main/src/index.ts")))
      .toEqual({ repoInput: "https://github.com/owner/repo", filePath: "src/index.ts" });
  });

  it("parses a GitLab blob URL (with the /-/ segment)", () => {
    expect(parseRemoteFileUrl(new URL("https://gitlab.com/owner/repo/-/blob/dev/a/b.rs")))
      .toEqual({ repoInput: "https://gitlab.com/owner/repo", filePath: "a/b.rs" });
  });

  it("parses a Bitbucket src URL", () => {
    expect(parseRemoteFileUrl(new URL("https://bitbucket.org/owner/repo/src/main/pkg/x.go")))
      .toEqual({ repoInput: "https://bitbucket.org/owner/repo", filePath: "pkg/x.go" });
  });

  it("parses a Codeberg src/branch URL", () => {
    expect(parseRemoteFileUrl(new URL("https://codeberg.org/owner/repo/src/branch/main/lib/y.py")))
      .toEqual({ repoInput: "https://codeberg.org/owner/repo", filePath: "lib/y.py" });
  });

  it("discards the ref: different refs yield the same repo+path", () => {
    const a = parseRemoteFileUrl(new URL("https://github.com/o/r/blob/main/x.ts"));
    const b = parseRemoteFileUrl(new URL("https://github.com/o/r/blob/9f8e7d6/x.ts"));
    expect(a).toEqual(b);
  });

  it("URL-decodes path segments and strips a trailing .git on the repo", () => {
    expect(parseRemoteFileUrl(new URL("https://github.com/o/r.git/blob/main/a%20b/c.ts")))
      .toEqual({ repoInput: "https://github.com/o/r", filePath: "a b/c.ts" });
  });

  it("rejects a bare repo URL with need_file", () => {
    expect(code(() => parseRemoteFileUrl(new URL("https://github.com/owner/repo")))).toBe("need_file");
  });

  it("rejects a non-file page on an allowlisted host with not_a_file_url", () => {
    expect(code(() => parseRemoteFileUrl(new URL("https://github.com/owner/repo/issues/1")))).toBe("not_a_file_url");
    expect(code(() => parseRemoteFileUrl(new URL("https://github.com/owner/repo/blob/main")))).toBe("not_a_file_url");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: FAIL — cannot find module `@/lib/source`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/source.ts`:

```ts
import { ValidationError } from "@/lib/validate";

// Given the path segments of a repo URL (segs[0]=owner, segs[1]=repo, …),
// return the file-path segments for this host, or null if it's not a file link.
function fileSegsFor(host: string, segs: string[]): string[] | null {
  if (host === "github.com") return segs[2] === "blob" ? segs.slice(4) : null;
  if (host === "gitlab.com") return segs[2] === "-" && segs[3] === "blob" ? segs.slice(5) : null;
  if (host === "bitbucket.org") return segs[2] === "src" ? segs.slice(4) : null;
  if (host === "codeberg.org") {
    return segs[2] === "src" && ["branch", "tag", "commit"].includes(segs[3]) ? segs.slice(5) : null;
  }
  return null;
}

export function parseRemoteFileUrl(url: URL): { repoInput: string; filePath: string } {
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length < 2) {
    throw new ValidationError("not_a_file_url", "That doesn't look like a link to a file in the repo.");
  }
  const owner = segs[0];
  const repo = segs[1].replace(/\.git$/, "");
  if (segs.length === 2) {
    throw new ValidationError("need_file", "That's a repository URL — paste a link to a file, or use manual entry.");
  }
  const fileSegs = fileSegsFor(url.hostname, segs);
  if (!fileSegs || fileSegs.length === 0) {
    throw new ValidationError("not_a_file_url", "That doesn't look like a link to a file in the repo.");
  }
  const filePath = fileSegs.map((s) => decodeURIComponent(s)).join("/");
  return { repoInput: `https://${url.hostname}/${owner}/${repo}`, filePath };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/source.ts tests/lib/source.test.ts
git commit -m "feat: parse remote file URLs into repo + path (ref discarded)"
```

---

### Task 2: Local repo inference

**Files:**
- Modify: `src/lib/source.ts` (add `inferLocalSource`)
- Test: `tests/lib/source.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: `validateLocalPath` + `ValidationError` from `@/lib/validate`; the `buildRepo` fixture from `tests/fixtures/git.ts`.
- Produces: `inferLocalSource(rawPath: string): Promise<{ repoInput: string; filePath: string }>` — validates `rawPath` is enabled + inside `LOCAL_ROOT`, finds its enclosing repo root via `git rev-parse --show-toplevel`, confirms the root is also inside `LOCAL_ROOT`, and returns the repo root as `repoInput` plus the file path relative to it. Throws `local_disabled`, `bad_path`, or `no_repo_found`.

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/source.test.ts`:

```ts
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildRepo, cleanupRepo } from "../fixtures/git";
import { inferLocalSource } from "@/lib/source";

describe("inferLocalSource", () => {
  const prevAllow = process.env.ALLOW_LOCAL_PATHS;
  const prevRoot = process.env.LOCAL_ROOT;
  afterEach(() => {
    process.env.ALLOW_LOCAL_PATHS = prevAllow;
    process.env.LOCAL_ROOT = prevRoot;
  });

  it("infers the repo root and relative path from an absolute file path", async () => {
    const dir = await buildRepo([{ path: "src/index.ts", content: "v1", message: "init" }]);
    process.env.ALLOW_LOCAL_PATHS = "1";
    process.env.LOCAL_ROOT = dir;
    const res = await inferLocalSource(path.join(dir, "src/index.ts"));
    expect(res).toEqual({ repoInput: dir, filePath: "src/index.ts" });
    await cleanupRepo(dir);
  });

  it("throws local_disabled when local paths are off", async () => {
    delete process.env.ALLOW_LOCAL_PATHS;
    await expect(inferLocalSource("/tmp/whatever/a.txt")).rejects.toMatchObject({ code: "local_disabled" });
  });

  it("throws bad_path for a file outside LOCAL_ROOT", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.ALLOW_LOCAL_PATHS = "1";
    process.env.LOCAL_ROOT = dir;
    await expect(inferLocalSource("/etc/hosts")).rejects.toMatchObject({ code: "bad_path" });
    await cleanupRepo(dir);
  });

  it("throws no_repo_found when there is no enclosing git repo", async () => {
    const plain = await fs.mkdtemp(path.join(os.tmpdir(), "ca-norepo-"));
    await fs.writeFile(path.join(plain, "a.txt"), "hi");
    process.env.ALLOW_LOCAL_PATHS = "1";
    process.env.LOCAL_ROOT = plain;
    await expect(inferLocalSource(path.join(plain, "a.txt"))).rejects.toMatchObject({ code: "no_repo_found" });
    await fs.rm(plain, { recursive: true, force: true });
  });
});
```

Also add `afterEach` to the existing top import line: change `import { describe, it, expect } from "vitest";` to `import { describe, it, expect, afterEach } from "vitest";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: FAIL — `inferLocalSource` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/source.ts` (top imports + the function):

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { validateLocalPath } from "@/lib/validate";

const run = promisify(execFile);

export async function inferLocalSource(rawPath: string): Promise<{ repoInput: string; filePath: string }> {
  // Reuses the ALLOW_LOCAL_PATHS gate + LOCAL_ROOT containment (throws local_disabled / bad_path).
  const file = validateLocalPath(rawPath);
  let root: string;
  try {
    const { stdout } = await run("git", ["-C", path.dirname(file), "rev-parse", "--show-toplevel"]);
    root = stdout.trim();
  } catch (err) {
    throw new ValidationError("no_repo_found", "No git repository found above that file.", { cause: err });
  }
  // The discovered repo root must also be inside the allowed root.
  const repoRoot = validateLocalPath(root);
  const filePath = path.relative(repoRoot, file).split(path.sep).join("/");
  return { repoInput: repoRoot, filePath };
}
```

Keep the existing `import { ValidationError } from "@/lib/validate";` line; you can merge it with the new `validateLocalPath` import: `import { ValidationError, validateLocalPath } from "@/lib/validate";`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: PASS (Task 1 cases + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/source.ts tests/lib/source.test.ts
git commit -m "feat: infer local repo root + relative path from an absolute file path"
```

---

### Task 3: `resolveInput` orchestrator

**Files:**
- Modify: `src/lib/source.ts` (add `resolveInput`)
- Test: `tests/lib/source.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: `parseRemoteFileUrl`, `inferLocalSource` (same module); `ALLOWED_HOSTS` from `@/lib/constants`; `ValidationError`.
- Produces: `resolveInput(raw: string): Promise<{ repoInput: string; filePath: string }>` — classifies `raw`: allowlisted-host `https:` file URL → `parseRemoteFileUrl`; `file:` URL or `/`-absolute path → `inferLocalSource`; everything else → throws `unrecognized_input`. Delegated errors (`need_file`, `not_a_file_url`, `local_disabled`, `bad_path`, `no_repo_found`) propagate.

- [ ] **Step 1: Write the failing test**

Append to `tests/lib/source.test.ts`:

```ts
import { resolveInput } from "@/lib/source";

describe("resolveInput", () => {
  const prevAllow = process.env.ALLOW_LOCAL_PATHS;
  const prevRoot = process.env.LOCAL_ROOT;
  afterEach(() => {
    process.env.ALLOW_LOCAL_PATHS = prevAllow;
    process.env.LOCAL_ROOT = prevRoot;
  });

  it("dispatches an allowlisted file URL to the remote parser", async () => {
    await expect(resolveInput("https://github.com/o/r/blob/main/a.ts"))
      .resolves.toEqual({ repoInput: "https://github.com/o/r", filePath: "a.ts" });
  });

  it("propagates need_file for a bare repo URL", async () => {
    await expect(resolveInput("https://github.com/o/r")).rejects.toMatchObject({ code: "need_file" });
  });

  it("rejects a non-allowlisted https host as unrecognized_input", async () => {
    await expect(resolveInput("https://evil.com/o/r/blob/main/a.ts"))
      .rejects.toMatchObject({ code: "unrecognized_input" });
  });

  it("rejects junk and empty input as unrecognized_input", async () => {
    await expect(resolveInput("not a url or path")).rejects.toMatchObject({ code: "unrecognized_input" });
    await expect(resolveInput("   ")).rejects.toMatchObject({ code: "unrecognized_input" });
  });

  it("dispatches an absolute path to local inference", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.ALLOW_LOCAL_PATHS = "1";
    process.env.LOCAL_ROOT = dir;
    await expect(resolveInput(path.join(dir, "a.txt")))
      .resolves.toEqual({ repoInput: dir, filePath: "a.txt" });
    await cleanupRepo(dir);
  });

  it("dispatches a file:// URL to local inference", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.ALLOW_LOCAL_PATHS = "1";
    process.env.LOCAL_ROOT = dir;
    await expect(resolveInput(`file://${path.join(dir, "a.txt")}`))
      .resolves.toEqual({ repoInput: dir, filePath: "a.txt" });
    await cleanupRepo(dir);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: FAIL — `resolveInput` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/source.ts`:

```ts
import { ALLOWED_HOSTS } from "@/lib/constants";

const UNRECOGNIZED =
  "Couldn't tell what that is — paste a file's URL (or an absolute file path), or enter the repo and path manually.";

export async function resolveInput(raw: string): Promise<{ repoInput: string; filePath: string }> {
  const trimmed = raw.trim();
  if (trimmed === "") throw new ValidationError("unrecognized_input", UNRECOGNIZED);

  let url: URL | null = null;
  try { url = new URL(trimmed); } catch { url = null; }

  if (url) {
    if (url.protocol === "file:") return inferLocalSource(decodeURIComponent(url.pathname));
    if (url.protocol === "https:" && (ALLOWED_HOSTS as readonly string[]).includes(url.hostname)) {
      return parseRemoteFileUrl(url);
    }
    throw new ValidationError("unrecognized_input", UNRECOGNIZED);
  }

  if (trimmed.startsWith("/")) return inferLocalSource(trimmed);
  throw new ValidationError("unrecognized_input", UNRECOGNIZED);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/source.test.ts`
Expected: PASS (all `source.test.ts` cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/source.ts tests/lib/source.test.ts
git commit -m "feat: add resolveInput orchestrator dispatching URL vs local path"
```

---

### Task 4: API route accepts `{ input }`

**Files:**
- Modify: `src/app/api/animations/route.ts`
- Test: `tests/api/post-animation.test.ts` (add cases)

**Interfaces:**
- Consumes: `resolveInput` from `@/lib/source`.
- Produces: `POST` now accepts a body of `{ input?: string }` OR `{ repoInput?: string; filePath?: string }`. When `input` is a non-empty string, the route resolves it via `resolveInput` (errors stream as SSE `error` events with the thrown code) and feeds the result to `extractAnimation`. The two-field body path is unchanged.

- [ ] **Step 1: Write the failing test**

Append cases inside the existing `describe("POST /api/animations", …)` block in `tests/api/post-animation.test.ts`:

```ts
  it("resolves a single absolute-path input and streams done", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.LOCAL_ROOT = dir;
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ input: path.join(dir, "a.txt") })
    });
    const joined = (await readSse(await POST(req))).join("\n");
    expect(joined).toContain("event: done");
    expect(joined).toMatch(/"id":"[A-Za-z0-9_-]{16}"/);
  });

  it("streams an error event for a bare repo URL input", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ input: "https://github.com/owner/repo" })
    });
    const joined = (await readSse(await POST(req))).join("\n");
    expect(joined).toContain("event: error");
    expect(joined).toContain("need_file");
  });

  it("streams an error event for unrecognized input", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ input: "not a url or path" })
    });
    const joined = (await readSse(await POST(req))).join("\n");
    expect(joined).toContain("event: error");
    expect(joined).toContain("unrecognized_input");
  });
```

(`path` is already imported at the top of this test file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/api/post-animation.test.ts`
Expected: FAIL — `input` is ignored, so `{ input: … }` hits the `bad_input` "Repository and file path are required" path; the done/need_file/unrecognized assertions fail.

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/animations/route.ts`, add the import near the others:

```ts
import { resolveInput } from "@/lib/source";
```

Change the body type and the resolution logic. Replace:

```ts
  let body: { repoInput?: string; filePath?: string } = {};
  try {
    body = (await req.json()) as { repoInput?: string; filePath?: string };
  } catch {
    body = {};
  }
  const { repoInput, filePath } = body;
```

with:

```ts
  let body: { input?: string; repoInput?: string; filePath?: string } = {};
  try {
    body = (await req.json()) as { input?: string; repoInput?: string; filePath?: string };
  } catch {
    body = {};
  }
```

Then inside the stream's `try` block, replace:

```ts
        if (!repoInput || !filePath) {
          throw new ValidationError("bad_input", "Repository and file path are required.");
        }
        const onProgress = (p: Progress) => send("progress", p);
        const payload = await extractAnimation({ repoInput, filePath }, onProgress);
```

with:

```ts
        let repoInput = body.repoInput;
        let filePath = body.filePath;
        if (typeof body.input === "string" && body.input.trim() !== "") {
          const resolved = await resolveInput(body.input);
          repoInput = resolved.repoInput;
          filePath = resolved.filePath;
        }
        if (!repoInput || !filePath) {
          throw new ValidationError("bad_input", "Repository and file path are required.");
        }
        const onProgress = (p: Progress) => send("progress", p);
        const payload = await extractAnimation({ repoInput, filePath }, onProgress);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/api/post-animation.test.ts`
Expected: PASS (existing 3 + new 3).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/animations/route.ts tests/api/post-animation.test.ts
git commit -m "feat: accept a single { input } body and resolve it server-side"
```

---

### Task 5: CreateForm single-field + manual toggle

**Files:**
- Modify: `src/components/CreateForm.tsx`
- Test: `tests/components/createForm.test.tsx`

**Interfaces:**
- Consumes: the existing SSE fetch flow (unchanged).
- Produces: the form defaults to one input (label "File URL") that posts `{ input }`; a toggle reveals the existing two fields (labels "Repository URL", "File path") that post `{ repoInput, filePath }`.

- [ ] **Step 1: Write the failing test**

Replace the body of `tests/components/createForm.test.tsx` with (keeps both existing behaviors via the manual toggle, adds the single-field case):

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

function stubDone() {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    sseStream([
      "event: progress\ndata: {\"phase\":\"cloning\"}\n\n",
      "event: done\ndata: {\"id\":\"abcdefghijklmnop\"}\n\n"
    ]),
    { headers: { "content-type": "text/event-stream" } }
  )));
}

beforeEach(() => { push.mockReset(); });

describe("CreateForm", () => {
  it("submits the single URL field as { input } and navigates on done", async () => {
    stubDone();
    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/file url/i), "https://github.com/a/b/blob/main/src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({ input: "https://github.com/a/b/blob/main/src/x.ts" });
  });

  it("manual mode submits { repoInput, filePath } and navigates on done", async () => {
    stubDone();
    render(<CreateForm />);
    await userEvent.click(screen.getByRole("button", { name: /manual/i }));
    await userEvent.type(screen.getByLabelText(/repository/i), "https://github.com/a/b");
    await userEvent.type(screen.getByLabelText(/file path/i), "src/x.ts");
    await userEvent.click(screen.getByRole("button", { name: /animate/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/a/abcdefghijklmnop"));
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body).toEqual({ repoInput: "https://github.com/a/b", filePath: "src/x.ts" });
  });

  it("shows an error and re-enables submit when the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    render(<CreateForm />);
    await userEvent.type(screen.getByLabelText(/file url/i), "https://github.com/a/b/blob/main/x.ts");
    const button = screen.getByRole("button", { name: /animate/i });
    await userEvent.click(button);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/createForm.test.tsx`
Expected: FAIL — there is no `/file url/i` field and no `/manual/i` toggle yet.

- [ ] **Step 3: Write minimal implementation**

Edit `src/components/CreateForm.tsx`. Add `mode` + `input` state and build the body by mode. Replace the state declarations:

```tsx
  const [repoInput, setRepoInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
```

with:

```tsx
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [input, setInput] = useState("");
  const [repoInput, setRepoInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
```

In `onSubmit`, replace the fetch body line:

```tsx
        body: JSON.stringify({ repoInput, filePath })
```

with:

```tsx
        body: JSON.stringify(mode === "url" ? { input } : { repoInput, filePath })
```

Replace the `<form>` ... fields block (the two `<label>`s) with the mode-aware fields plus a toggle:

```tsx
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "url" ? (
            <label className={styles.field}>File URL
              <input className={styles.input} value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="https://github.com/owner/repo/blob/main/src/index.ts" required />
            </label>
          ) : (
            <>
              <label className={styles.field}>Repository URL
                <input className={styles.input} value={repoInput} onChange={(e) => setRepoInput(e.target.value)}
                  placeholder="https://github.com/owner/repo" required />
              </label>
              <label className={styles.field}>File path
                <input className={styles.input} value={filePath} onChange={(e) => setFilePath(e.target.value)}
                  placeholder="src/index.ts" required />
              </label>
            </>
          )}
          <button className={styles.button} type="submit" disabled={busy}>Animate</button>
        </form>
        <button type="button" className={styles.linkButton} onClick={() => setMode(mode === "url" ? "manual" : "url")}>
          {mode === "url" ? "Enter repo and path manually" : "Paste a file URL instead"}
        </button>
```

- [ ] **Step 4: Add the toggle style**

Append to `src/components/CreateForm.module.css`:

```css
.linkButton {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/createForm.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateForm.tsx src/components/CreateForm.module.css tests/components/createForm.test.tsx
git commit -m "feat: CreateForm single file-URL field with manual repo+path fallback"
```

---

### Task 6: E2E — single absolute-path input

**Files:**
- Test: `tests/e2e/single-input.spec.ts` (new)

**Interfaces:**
- Consumes: the e2e fixture repo path written to `.data/e2e-repo-path` by `tests/e2e/fixture-repo.setup.ts`; the running app (`ALLOW_LOCAL_PATHS=1`, `LOCAL_ROOT` set via the Playwright `webServer` env in `playwright.config.ts`).
- Produces: an end-to-end check that pasting one absolute file path into the default field reaches the player.

- [ ] **Step 1: Write the E2E test**

Create `tests/e2e/single-input.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";

test("single input: paste an absolute file path", async ({ page }) => {
  const repoDir = (await fs.readFile(".data/e2e-repo-path", "utf8")).trim();

  await page.goto("/create");
  await page.getByLabel(/file url/i).fill(`${repoDir}/demo.txt`);
  await page.getByRole("button", { name: /animate/i }).click();

  await page.waitForURL(/\/a\/.+/, { timeout: 60000 });
  await expect(page.getByText("1 / 2")).toBeVisible();
});
```

- [ ] **Step 2: Run the E2E test**

Run: `npm run e2e -- single-input.spec.ts`
Expected: PASS.

Note: if the dev/build server isn't running, the Playwright `webServer` block builds and starts it automatically. If this environment cannot launch Chromium (missing system libs like `libnspr4.so`), the test cannot execute here — in that case do NOT fabricate a result: keep the spec file as written, run `npx vitest run` to confirm no unit regressions, run `npm run build` to confirm the app compiles, and report the E2E as unrun (DONE_WITH_CONCERNS) for a human to run.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/single-input.spec.ts
git commit -m "test: e2e single absolute-path input reaches the player"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-24-single-input-create-design.md`):
- New module `src/lib/source.ts` with `resolveInput` → Tasks 1–3. ✓
- Disambiguation order (remote URL / file:// / absolute path / errors) → Task 3. ✓
- Per-host blob parsing (GitHub/GitLab/Bitbucket/Codeberg), ref discarded, `.git` stripped, decoded path → Task 1. ✓
- Local inference: `LOCAL_ROOT` containment for file AND repo root, `rev-parse --show-toplevel`, relative path, `no_repo_found` → Task 2. ✓
- Reuse of existing validation downstream (host allowlist/SSRF/traversal) → unchanged `resolveSource`/`extractAnimation`; route only swaps in the resolved pair (Task 4). ✓
- API accepts `{ input }` or `{ repoInput, filePath }`; errors over SSE → Task 4. ✓
- Form: single field primary + manual toggle fallback → Task 5. ✓
- Ref parsed-then-discarded, no UI note → Tasks 1/3 discard the ref; no note added anywhere. ✓
- Error codes `need_file`/`not_a_file_url`/`unrecognized_input`/`no_repo_found` + reused `bad_path`/`local_disabled`/`bad_input` → Tasks 1–4. ✓
- Testing: unit (`source.test.ts`), API, component, E2E → Tasks 1–6. ✓

**Placeholder scan:** No TBD/placeholder steps; every code step shows full content. ✓

**Type consistency:** `{ repoInput: string; filePath: string }` return shape is identical across `parseRemoteFileUrl` (Task 1), `inferLocalSource` (Task 2), `resolveInput` (Task 3), and the route call site (Task 4). `resolveInput` is `async` and is `await`ed in the route. `ALLOWED_HOSTS` is cast to `readonly string[]` for `.includes`. Form labels "File URL" / "Repository URL" / "File path" match the test queries (`/file url/i`, `/repository/i`, `/file path/i`) and the toggle button matches `/manual/i`. ✓
