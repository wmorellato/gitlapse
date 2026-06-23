import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type DatabaseNamespace from "better-sqlite3";

type DB = DatabaseNamespace.Database;

// better-sqlite3 is a native addon. Importing it at module-eval time means every
// module that touches the store loads the binary up front — which crashes Next
// build workers during page-data collection and adds serverless cold-start cost.
// Defer the require until a database is actually opened (request time).
const require = createRequire(import.meta.url);
let DatabaseCtor: typeof DatabaseNamespace | null = null;
function loadDatabase(): typeof DatabaseNamespace {
  if (!DatabaseCtor) DatabaseCtor = require("better-sqlite3") as typeof DatabaseNamespace;
  return DatabaseCtor;
}

const cache = new Map<string, DB>();

export function ensureSchema(db: DB): DB {
  db.exec(`
    CREATE TABLE IF NOT EXISTS animations (
      id TEXT PRIMARY KEY,
      repo_url TEXT,
      file_path TEXT NOT NULL,
      language TEXT NOT NULL,
      commit_count INTEGER NOT NULL,
      truncated INTEGER NOT NULL,
      byte_size INTEGER NOT NULL,
      payload BLOB NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function getDb(file = process.env.DB_FILE ?? ".data/animations.db"): DB {
  const existing = cache.get(file);
  if (existing) return existing;
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const Database = loadDatabase();
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);
  cache.set(file, db);
  return db;
}
