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
