import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CLONE_TIMEOUT_MS } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";

const run = promisify(execFile);

const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_ASKPASS: "true",
  GCM_INTERACTIVE: "never"
};

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ca-clone-"));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function cloneRepo(source: string, destDir: string): Promise<void> {
  try {
    await run(
      "git",
      ["clone", "--filter=blob:none", "--no-checkout", "--single-branch", source, destDir],
      { env: GIT_ENV, timeout: CLONE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (err) {
    throw new ValidationError("clone_failed", "Couldn't access that repository — is it public?", { cause: err });
  }
}
