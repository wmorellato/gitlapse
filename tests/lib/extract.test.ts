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
