import { gzipSync, gunzipSync } from "node:zlib";
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/store/db";
import { MAX_PAYLOAD_BYTES } from "@/lib/constants";
import { ValidationError } from "@/lib/validate";
import type { AnimationPayload, AnimationRecord } from "@/lib/types";

interface Row {
  id: string; repo_url: string | null; file_path: string; language: string;
  commit_count: number; truncated: number; byte_size: number;
  payload: Buffer; created_at: number;
}

export function createAnimation(payload: AnimationPayload, db: Database.Database = getDb()): { id: string; byteSize: number } {
  const gz = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  if (gz.byteLength > MAX_PAYLOAD_BYTES) {
    throw new ValidationError("too_large", "This animation is too large to store.");
  }
  const id = nanoid(16);
  db.prepare(
    `INSERT INTO animations (id, repo_url, file_path, language, commit_count, truncated, byte_size, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, payload.repo.url, payload.filePath, payload.language,
    payload.commits.length, payload.truncated ? 1 : 0, gz.byteLength, gz, Date.now()
  );
  return { id, byteSize: gz.byteLength };
}

export function findAnimation(id: string, db: Database.Database = getDb()): AnimationRecord | null {
  const row = db.prepare(`SELECT * FROM animations WHERE id = ?`).get(id) as Row | undefined;
  if (!row) return null;
  const payload = JSON.parse(gunzipSync(row.payload).toString("utf8")) as AnimationPayload;
  return {
    id: row.id, repoUrl: row.repo_url, filePath: row.file_path, language: row.language,
    commitCount: row.commit_count, truncated: !!row.truncated, byteSize: row.byte_size,
    createdAt: row.created_at, payload
  };
}
