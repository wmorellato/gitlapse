import path from "node:path";
import {
  validateFilePath,
  validateRepoUrl,
  assertPublicHost,
  validateLocalPath,
  ValidationError
} from "@/lib/validate";
import { cloneRepo, withTempDir } from "@/lib/git/clone";
import { getHistory } from "@/lib/git/history";
import { getFileAt } from "@/lib/git/snapshot";
import { detectLanguage } from "@/lib/language";
import type { AnimationPayload, CommitSnapshot } from "@/lib/types";

export type Progress =
  | { phase: "cloning" }
  | { phase: "history" }
  | { phase: "snapshots"; current: number; total: number };

export interface ExtractInput {
  repoInput: string;
  filePath: string;
}

function displayNameFromUrl(url: URL): string {
  const segs = url.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
  return segs.slice(-2).join("/") || url.hostname;
}

async function resolveSource(
  repoInput: string
): Promise<{ source: string; url: string | null; displayName: string }> {
  let url: URL | null = null;
  try {
    url = validateRepoUrl(repoInput);
  } catch (e) {
    // Not a valid allowlisted URL — fall back to a local path (self-host only).
    if (process.env.ALLOW_LOCAL_PATHS === "1") {
      const resolved = validateLocalPath(repoInput);
      return { source: resolved, url: null, displayName: path.basename(resolved) };
    }
    throw e;
  }
  await assertPublicHost(url.hostname);
  return { source: url.toString(), url: url.toString(), displayName: displayNameFromUrl(url) };
}

export async function extractAnimation(
  input: ExtractInput,
  onProgress: (p: Progress) => void = () => {}
): Promise<AnimationPayload> {
  const filePath = validateFilePath(input.filePath);
  const { source, url, displayName } = await resolveSource(input.repoInput);

  return withTempDir(async (dir) => {
    onProgress({ phase: "cloning" });
    await cloneRepo(source, dir);

    onProgress({ phase: "history" });
    const { commits, truncated } = await getHistory(dir, filePath);

    const snapshots: CommitSnapshot[] = [];
    for (let i = 0; i < commits.length; i++) {
      onProgress({ phase: "snapshots", current: i + 1, total: commits.length });
      const c = commits[i];
      const content = await getFileAt(dir, c.sha, c.pathAtCommit);
      snapshots.push({
        sha: c.sha,
        shortSha: c.shortSha,
        message: c.message,
        author: c.author,
        timestamp: c.timestamp,
        content,
        status: c.status
      });
    }

    return {
      version: 1,
      repo: { url, displayName },
      filePath,
      language: detectLanguage(filePath),
      truncated,
      commits: snapshots
    };
  });
}
