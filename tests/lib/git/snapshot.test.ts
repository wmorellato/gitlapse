import { describe, it, expect, afterAll } from "vitest";
import { getFileAt, isBinary } from "@/lib/git/snapshot";
import { getHistory } from "@/lib/git/history";
import { buildRepo, cleanupRepo } from "../../fixtures/git";
import { MAX_FILE_BYTES } from "@/lib/constants";

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

  it("rejects binary files", async () => {
    const dir = await buildRepo([{ path: "bin.dat", content: "abc\0def", message: "add bin" }]);
    dirs.push(dir);
    const { commits } = await getHistory(dir, "bin.dat");
    await expect(getFileAt(dir, commits[0].sha, commits[0].pathAtCommit)).rejects.toMatchObject({ code: "binary" });
  });

  it("rejects files over the size cap", async () => {
    const big = "x".repeat(MAX_FILE_BYTES + 1024);
    const dir = await buildRepo([{ path: "big.txt", content: big, message: "add big" }]);
    dirs.push(dir);
    const { commits } = await getHistory(dir, "big.txt");
    await expect(getFileAt(dir, commits[0].sha, commits[0].pathAtCommit)).rejects.toMatchObject({ code: "too_large" });
  });

  it("returns empty string when the path is absent at the commit", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    dirs.push(dir);
    const { commits } = await getHistory(dir, "a.txt");
    expect(await getFileAt(dir, commits[0].sha, "nope.txt")).toBe("");
  });
});
