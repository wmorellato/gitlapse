import Database from "better-sqlite3";

let cached: Database.Database | null = null;

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
  if (cached) return cached;
  cached = new Database(file);
  cached.pragma("journal_mode = WAL");
  ensureSchema(cached);
  return cached;
}
