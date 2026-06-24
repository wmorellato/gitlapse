import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { ValidationError, validateLocalPath } from "@/lib/validate";
import { ALLOWED_HOSTS } from "@/lib/constants";

const run = promisify(execFile);

// Given the path segments of a repo URL (segs[0]=owner, segs[1]=repo, …),
// return the file-path segments for this host, or null if it's not a file link.
function fileSegsFor(host: string, segs: string[]): string[] | null {
  if (host === "github.com") return segs[2] === "blob" ? segs.slice(4) : null;
  if (host === "gitlab.com") return segs[2] === "-" && segs[3] === "blob" ? segs.slice(5) : null;
  if (host === "bitbucket.org") return segs[2] === "src" ? segs.slice(4) : null;
  if (host === "codeberg.org") {
    return segs[2] === "src" && ["branch", "tag", "commit"].includes(segs[3]) ? segs.slice(5) : null;
  }
  return null;
}

export function parseRemoteFileUrl(url: URL): { repoInput: string; filePath: string } {
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length < 2) {
    throw new ValidationError("not_a_file_url", "That doesn't look like a link to a file in the repo.");
  }
  const owner = segs[0];
  const repo = segs[1].replace(/\.git$/, "");
  if (segs.length === 2) {
    throw new ValidationError("need_file", "That's a repository URL — paste a link to a file, or use manual entry.");
  }
  const fileSegs = fileSegsFor(url.hostname, segs);
  if (!fileSegs || fileSegs.length === 0) {
    throw new ValidationError("not_a_file_url", "That doesn't look like a link to a file in the repo.");
  }
  const filePath = fileSegs.map((s) => decodeURIComponent(s)).join("/");
  return { repoInput: `https://${url.hostname}/${owner}/${repo}`, filePath };
}

export async function inferLocalSource(rawPath: string): Promise<{ repoInput: string; filePath: string }> {
  // Reuses the ALLOW_LOCAL_PATHS gate + LOCAL_ROOT containment (throws local_disabled / bad_path).
  const file = validateLocalPath(rawPath);
  let root: string;
  try {
    const { stdout } = await run("git", ["-C", path.dirname(file), "rev-parse", "--show-toplevel"]);
    root = stdout.trim();
  } catch (err) {
    throw new ValidationError("no_repo_found", "No git repository found above that file.", { cause: err });
  }
  // The discovered repo root must also be inside the allowed root.
  const repoRoot = validateLocalPath(root);
  const filePath = path.relative(repoRoot, file).split(path.sep).join("/");
  return { repoInput: repoRoot, filePath };
}

const UNRECOGNIZED =
  "Couldn't tell what that is — paste a file's URL (or an absolute file path), or enter the repo and path manually.";

export async function resolveInput(raw: string): Promise<{ repoInput: string; filePath: string }> {
  const trimmed = raw.trim();
  if (trimmed === "") throw new ValidationError("unrecognized_input", UNRECOGNIZED);

  let url: URL | null = null;
  try { url = new URL(trimmed); } catch { url = null; }

  if (url) {
    if (url.protocol === "file:") return inferLocalSource(decodeURIComponent(url.pathname));
    if (url.protocol === "https:" && (ALLOWED_HOSTS as readonly string[]).includes(url.hostname)) {
      return parseRemoteFileUrl(url);
    }
    throw new ValidationError("unrecognized_input", UNRECOGNIZED);
  }

  if (trimmed.startsWith("/")) return inferLocalSource(trimmed);
  throw new ValidationError("unrecognized_input", UNRECOGNIZED);
}
