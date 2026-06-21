import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { ensureSchema } from "@/lib/store/db";
import { createAnimation } from "@/lib/store/animations";
import { GET } from "@/app/api/animations/[id]/route";
import type { AnimationPayload } from "@/lib/types";

const db = ensureSchema(new Database(":memory:"));

const payload: AnimationPayload = {
  version: 1, repo: { url: null, displayName: "x" }, filePath: "a.txt",
  language: "plaintext", truncated: false,
  commits: [{ sha: "s", shortSha: "s", message: "m", author: { name: "n", email: "e" },
    timestamp: "2026-01-01T00:00:00Z", content: "hi", status: "added" }]
};

describe("GET /api/animations/:id", () => {
  it("returns 404 for unknown id", async () => {
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "nope" }), db });
    expect(res.status).toBe(404);
  });

  it("returns the payload for a known id", async () => {
    const { id } = createAnimation(payload, db);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id }), db });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.payload.commits[0].content).toBe("hi");
  });
});
