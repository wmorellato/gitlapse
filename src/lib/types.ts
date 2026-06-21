export type CommitStatus = "added" | "modified" | "deleted";

export interface CommitMeta {
  sha: string;
  shortSha: string;
  message: string;          // full message; UI shows first line
  author: { name: string; email: string };
  timestamp: string;        // ISO 8601
  pathAtCommit: string;     // file path valid at this commit (rename-aware)
  status: CommitStatus;
}

export interface CommitSnapshot {
  sha: string;
  shortSha: string;
  message: string;
  author: { name: string; email: string };
  timestamp: string;
  content: string;
  status: CommitStatus;
}

export interface AnimationPayload {
  version: 1;
  repo: { url: string | null; displayName: string };
  filePath: string;
  language: string;
  truncated: boolean;
  commits: CommitSnapshot[];
}

export interface AnimationRecord {
  id: string;
  repoUrl: string | null;
  filePath: string;
  language: string;
  commitCount: number;
  truncated: boolean;
  byteSize: number;
  createdAt: number;
  payload: AnimationPayload;
}
