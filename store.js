'use strict';
/**
 * Message store. Prefers SQLite (better-sqlite3); if that native module is
 * unavailable, falls back to a tiny JSON-file store with the same interface:
 *   addMessage({to, from, body})  -> stored message
 *   getMessages(number)           -> array, newest first
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let impl = null;
let backendName = 'json';

try {
  const Database = require('better-sqlite3');
  const db = new Database(path.join(DATA_DIR, 'messages.db'));
  db.prepare(
    'CREATE TABLE IF NOT EXISTS messages (' +
    'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
    'to_num TEXT NOT NULL, from_num TEXT, body TEXT, ts INTEGER NOT NULL)'
  ).run();
  const insertStmt = db.prepare(
    'INSERT INTO messages (to_num, from_num, body, ts) VALUES (?, ?, ?, ?)'
  );
  const selectStmt = db.prepare(
    'SELECT to_num AS "to", from_num AS "from", body, ts FROM messages ' +
    'WHERE to_num = ? ORDER BY id DESC LIMIT 200'
  );
  impl = {
    addMessage(msg) {
      const ts = Date.now();
      insertStmt.run(msg.to, msg.from || '', msg.body || '', ts);
      return { to: msg.to, from: msg.from || '', body: msg.body || '', ts };
    },
    getMessages(num) {
      return selectStmt.all(num);
    }
  };
  backendName = 'sqlite (better-sqlite3)';
} catch (e) {
  // JSON-file fallback
  const FILE = path.join(DATA_DIR, 'messages.json');
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch (err) {
      return [];
    }
  }
  function writeAll(rows) {
    fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
  }
  impl = {
    addMessage(msg) {
      const rows = readAll();
      const stored = { to: msg.to, from: msg.from || '', body: msg.body || '', ts: Date.now() };
      rows.push(stored);
      writeAll(rows);
      return stored;
    },
    getMessages(num) {
      return readAll().filter(r => r.to === num).reverse().slice(0, 200);
    }
  };
  backendName = 'json file';
}

module.exports = { store: impl, backendName };
