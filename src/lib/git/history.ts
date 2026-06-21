import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MAX_COMMITS } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";
import type { CommitMeta, CommitStatus } from "@/lib/types";

const run = promisify(execFile);
const NUL = "\x00";
// `%x00` is git's placeholder syntax for emitting a literal NUL byte into the
// output. We must use the placeholder (not an actual "\x00" character) here
// because Node's execFile rejects argv strings that contain real null bytes.
// Per commit: NUL H NUL h NUL an NUL ae NUL cI NUL B NUL, then a newline and
// the --name-status lines (which land in the token after the body).
const FORMAT = "%x00%H%x00%h%x00%an%x00%ae%x00%cI%x00%B%x00";

function statusFor(nameStatus: string, fallbackPath: string): { status: CommitStatus; path: string } {
  const line = nameStatus.split("\n").find((l) => l.trim() !== "");
  if (!line) return { status: "modified", path: fallbackPath };
  const cols = line.split("\t");
  const code = cols[0][0];
  if (code === "A") return { status: "added", path: cols[1] ?? fallbackPath };
  if (code === "D") return { status: "deleted", path: cols[1] ?? fallbackPath };
  if (code === "R") return { status: "modified", path: cols[2] ?? fallbackPath };
  return { status: "modified", path: cols[1] ?? fallbackPath };
}

export async function getHistory(
  repoDir: string,
  filePath: string
): Promise<{ commits: CommitMeta[]; truncated: boolean }> {
  const { stdout } = await run(
    "git",
    ["-C", repoDir, "log", "--follow", "--name-status", `--format=${FORMAT}`, "--", filePath],
    { maxBuffer: 64 * 1024 * 1024 }
  );
  // Splitting on NUL yields: ["", H, h, an, ae, cI, B, nameStatus, H, h, ...]
  // i.e. a leading "" then groups of 7 fields per commit.
  const tokens = stdout.split(NUL);
  const commits: CommitMeta[] = [];
  for (let i = 1; i + 6 < tokens.length; i += 7) {
    const [sha, shortSha, an, ae, cI, body, nameStatus] = tokens.slice(i, i + 7);
    if (!sha) continue;
    const { status, path } = statusFor(nameStatus, filePath);
    commits.push({
      sha,
      shortSha,
      message: body,
      author: { name: an, email: ae },
      timestamp: cI,
      pathAtCommit: path,
      status
    });
  }
  if (commits.length === 0) {
    throw new ValidationError("not_found", "That path doesn't exist in this repository.");
  }
  commits.reverse(); // git log is newest-first; we want oldest-first
  const truncated = commits.length > MAX_COMMITS;
  return { commits: truncated ? commits.slice(commits.length - MAX_COMMITS) : commits, truncated };
}
