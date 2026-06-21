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
