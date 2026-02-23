const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dbDir, 'db.sqlite');

let db;

// Try better-sqlite3 first (production, native), fall back to sql.js (dev, pure JS)
try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db._engine = 'better-sqlite3';
  console.log('Using better-sqlite3 (native)');
} catch (e) {
  const initSqlJs = require('sql.js');
  let sqlDb;
  let saveTimer = null;

  const initPromise = initSqlJs().then(SQL => {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      sqlDb = new SQL.Database(buffer);
    } else {
      sqlDb = new SQL.Database();
    }
    // Enable foreign keys
    sqlDb.run('PRAGMA foreign_keys = ON');
    return sqlDb;
  });

  function saveToDisk() {
    if (!sqlDb) return;
    // Debounce saves to avoid excessive IO
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = sqlDb.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
      } catch(e) { console.error('DB save error:', e.message); }
    }, 100);
  }

  function saveNow() {
    if (!sqlDb) return;
    if (saveTimer) clearTimeout(saveTimer);
    try {
      const data = sqlDb.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch(e) { console.error('DB save error:', e.message); }
  }

  db = {
    _engine: 'sql.js',
    _ready: initPromise,

    exec(sql) {
      // sql.js exec handles multiple statements
      sqlDb.exec(sql);
      saveNow();
    },

    pragma(val) {
      try { sqlDb.run(`PRAGMA ${val}`); } catch(e) {}
    },

    prepare(sql) {
      return {
        run(...params) {
          // sql.js run expects array of params
          sqlDb.run(sql, params);
          saveToDisk();
          const lastIdResult = sqlDb.exec('SELECT last_insert_rowid() as id');
          const lastId = lastIdResult.length ? lastIdResult[0].values[0][0] : 0;
          const changes = sqlDb.getRowsModified();
          return { lastInsertRowid: lastId, changes };
        },

        get(...params) {
          const stmt = sqlDb.prepare(sql);
          if (params.length) stmt.bind(params);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            stmt.free();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            return row;
          }
          stmt.free();
          return undefined;
        },

        all(...params) {
          const results = [];
          const stmt = sqlDb.prepare(sql);
          if (params.length) stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            results.push(row);
          }
          stmt.free();
          return results;
        }
      };
    },

    transaction(fn) {
      return (...args) => {
        sqlDb.run('BEGIN TRANSACTION');
        try {
          const result = fn(...args);
          sqlDb.run('COMMIT');
          saveNow();
          return result;
        } catch (e) {
          try { sqlDb.run('ROLLBACK'); } catch(re) {}
          throw e;
        }
      };
    }
  };

  console.log('Using sql.js (pure JavaScript fallback)');
}

module.exports = db;
