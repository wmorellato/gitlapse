import { describe, it, expect, afterEach } from "vitest";
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
