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
