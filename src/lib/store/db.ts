import Database from "better-sqlite3";

const cache = new Map<string, Database.Database>();

export function ensureSchema(db: Database.Database): Database.Database {
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

export function getDb(file = process.env.DB_FILE ?? ".data/animations.db"): Database.Database {
  const existing = cache.get(file);
  if (existing) return existing;
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  ensureSchema(db);
  cache.set(file, db);
  return db;
}
