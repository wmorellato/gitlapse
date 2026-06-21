import { describe, it, expect, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildRepo, cleanupRepo } from "./git";

const run = promisify(execFile);
const dirs: string[] = [];

describe("buildRepo", () => {
  afterAll(async () => {
    for (const d of dirs) {
      await cleanupRepo(d);
    }
  });

  it("creates a repo with the requested commits", async () => {
    const dir = await buildRepo([
      { path: "a.txt", content: "v1", message: "add a" },
      { path: "a.txt", content: "v2", message: "edit a" }
    ]);
    dirs.push(dir);
    const { stdout } = await run("git", ["-C", dir, "log", "--oneline"]);
    expect(stdout.trim().split("\n")).toHaveLength(2);
  });

  it("renames a file into a new subdirectory", async () => {
    const d = await buildRepo([
      { path: "a.txt", content: "v1", message: "add a" },
      { path: "sub/dir/b.txt", content: "v1", message: "move a", rename: { from: "a.txt" } }
    ]);
    dirs.push(d);
    try {
      const log = await run("git", ["-C", d, "log", "--oneline"]);
      expect(log.stdout.trim().split("\n")).toHaveLength(2);
      const ls = await run("git", ["-C", d, "ls-files"]);
      expect(ls.stdout).toContain("sub/dir/b.txt");
      expect(ls.stdout).not.toContain("a.txt");
    } finally {
      // Cleanup will happen in afterAll
    }
  });
});
