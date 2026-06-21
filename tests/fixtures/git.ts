import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const run = promisify(execFile);

export interface FixtureCommit {
  path: string;
  content: string;
  message: string;
  rename?: { from: string };
}

const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com",
  GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z"
};

export async function buildRepo(commits: FixtureCommit[]): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fix-repo-"));
  await run("git", ["-C", dir, "init", "-q", "-b", "main"], { env: ENV });
  for (const c of commits) {
    if (c.rename) {
      await run("git", ["-C", dir, "mv", c.rename.from, c.path], { env: ENV });
    }
    await fs.mkdir(path.dirname(path.join(dir, c.path)), { recursive: true });
    await fs.writeFile(path.join(dir, c.path), c.content);
    await run("git", ["-C", dir, "add", "-A"], { env: ENV });
    await run("git", ["-C", dir, "commit", "-q", "-m", c.message], { env: ENV });
  }
  return dir;
}

export async function cleanupRepo(dir: string): Promise<void> {
  await fs.rm(dir, { recursive: true, force: true });
}
