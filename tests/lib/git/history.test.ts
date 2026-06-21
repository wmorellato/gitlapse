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
