import { describe, it, expect, beforeAll, afterAll } from "vitest";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { buildRepo } from "../fixtures/git";
import { POST } from "@/app/api/animations/route";

let dbDir = "";

beforeAll(async () => {
  process.env.ALLOW_LOCAL_PATHS = "1";
  dbDir = await fs.mkdtemp(path.join(os.tmpdir(), "ca-post-"));
  process.env.DB_FILE = path.join(dbDir, "test.db");
});

afterAll(async () => {
  if (dbDir) await fs.rm(dbDir, { recursive: true, force: true });
});

async function readSse(res: Response): Promise<string[]> {
  const text = await res.text();
  return text.split("\n\n").filter((b) => b.trim() !== "");
}

describe("POST /api/animations", () => {
  it("streams progress then a done event with an id", async () => {
    const dir = await buildRepo([{ path: "a.txt", content: "v1", message: "init" }]);
    process.env.LOCAL_ROOT = dir;
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ repoInput: dir, filePath: "a.txt" })
    });
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await readSse(res);
    const joined = events.join("\n");
    expect(joined).toContain("event: done");
    expect(joined).toMatch(/"id":"[A-Za-z0-9_-]{16}"/);
  });

  it("streams an error event for a disallowed repo", async () => {
    const req = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ repoInput: "https://evil.com/a/b", filePath: "a.txt" })
    });
    const res = await POST(req);
    const joined = (await readSse(res)).join("\n");
    expect(joined).toContain("event: error");
  });

  it("streams an error event for a malformed JSON body", async () => {
    const req = new Request("http://x", { method: "POST", body: "not json{" });
    const res = await POST(req);
    const joined = (await readSse(res)).join("\n");
    expect(joined).toContain("event: error");
  });
});
