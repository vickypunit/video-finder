import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export function openDb(file = config.dbPath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_key TEXT NOT NULL,
      input TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      counts_json TEXT NOT NULL,
      payload_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS seen_videos (
      product_key TEXT NOT NULL,
      video_key TEXT NOT NULL,
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (product_key, video_key)
    );
    CREATE TABLE IF NOT EXISTS cursors (
      product_key TEXT NOT NULL,
      source TEXT NOT NULL,
      cursor TEXT,
      PRIMARY KEY (product_key, source)
    );
  `);

  return {
    raw: db,
    getSeen: (productKey) =>
      new Set(db.prepare('SELECT video_key FROM seen_videos WHERE product_key = ?').all(productKey).map((r) => r.video_key)),
    markSeen: db.transaction((productKey, keys) => {
      const stmt = db.prepare('INSERT OR IGNORE INTO seen_videos (product_key, video_key) VALUES (?, ?)');
      keys.forEach((k) => stmt.run(productKey, k));
    }),
    getCursor: (productKey, source) =>
      db.prepare('SELECT cursor FROM cursors WHERE product_key = ? AND source = ?').get(productKey, source)?.cursor ?? null,
    setCursor: (productKey, source, cursor) =>
      db.prepare('INSERT INTO cursors (product_key, source, cursor) VALUES (?,?,?) ON CONFLICT(product_key, source) DO UPDATE SET cursor = excluded.cursor').run(productKey, source, cursor),
    saveSearch: ({ productKey, input, title, counts, payload }) =>
      db.prepare('INSERT INTO searches (product_key, input, title, counts_json, payload_json) VALUES (?,?,?,?,?)')
        .run(productKey, input, title, JSON.stringify(counts), JSON.stringify(payload)).lastInsertRowid,
    listSearches: () =>
      db.prepare('SELECT id, product_key, input, title, created_at, counts_json FROM searches ORDER BY id DESC LIMIT 50').all()
        .map((r) => ({ id: r.id, productKey: r.product_key, input: r.input, title: r.title, createdAt: r.created_at, counts: JSON.parse(r.counts_json) })),
    getSearch: (id) => {
      const r = db.prepare('SELECT payload_json FROM searches WHERE id = ?').get(id);
      return r ? JSON.parse(r.payload_json) : null;
    },
    clearAll: () => db.exec('DELETE FROM searches; DELETE FROM seen_videos; DELETE FROM cursors;'),
  };
}
