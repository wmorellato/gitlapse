import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createAnimation, findAnimation } from "@/lib/store/animations";
import { ensureSchema, getDb } from "@/lib/store/db";
import type { AnimationPayload } from "@/lib/types";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { ValidationError } from "@/lib/validate";

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

  it("throws too_large when the gzipped payload exceeds the cap", () => {
    const p = payload();
    // base64 of random bytes is incompressible, so gzip stays > 5MB
    p.commits[0].content = randomBytes(6 * 1024 * 1024).toString("base64");
    try {
      createAnimation(p, db);
      throw new Error("expected createAnimation to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).code).toBe("too_large");
    }
  });

  it("round-trips truncated = true", () => {
    const p = payload();
    p.truncated = true;
    const { id } = createAnimation(p, db);
    expect(findAnimation(id, db)?.truncated).toBe(true);
  });

  it("memoizes the database per file and creates schema on first use", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "store-"));
    const file = path.join(dir, "a.db");
    const a = getDb(file);
    const b = getDb(file);
    expect(a).toBe(b);
    const { id } = createAnimation(payload(), a);
    expect(findAnimation(id, a)?.commitCount).toBe(1);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
