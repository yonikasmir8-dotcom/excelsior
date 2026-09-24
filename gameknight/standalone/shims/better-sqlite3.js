// better-sqlite3 API over sql.js (SQLite compiled to JS), just enough for GameKnight.
// Statements are prepared lazily and cached by SQL text; db.export() frees sql.js
// statements, so the cache is dropped and statements re-prepare on next use.

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; }
  _stmt() { return this.db._prepare(this.sql); }
  _bind(stmt, args) {
    stmt.reset();
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
      const named = {};
      for (const [k, v] of Object.entries(args[0])) if (this.sql.includes('@' + k)) named['@' + k] = v === undefined ? null : v;
      stmt.bind(named);
    } else if (args.length) {
      stmt.bind(args.map(v => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)));
    }
  }
  get(...args) {
    const s = this._stmt(); this._bind(s, args);
    const row = s.step() ? s.getAsObject() : undefined;
    s.reset();
    return row;
  }
  all(...args) {
    const s = this._stmt(); this._bind(s, args);
    const rows = [];
    while (s.step()) rows.push(s.getAsObject());
    s.reset();
    return rows;
  }
  run(...args) {
    const s = this._stmt(); this._bind(s, args);
    s.step(); s.reset();
    return { changes: this.db.raw.getRowsModified(), lastInsertRowid: this.db._lastId() };
  }
}

class Database {
  constructor() {
    const SQL = globalThis.__GK_SQL;
    this.raw = new SQL.Database(globalThis.__GK_DB_BYTES || undefined);
    this.cache = new Map();
    this.depth = 0;
    globalThis.__GK_DB = this;
  }
  _prepare(sql) {
    let s = this.cache.get(sql);
    if (!s) { s = this.raw.prepare(sql); this.cache.set(sql, s); }
    return s;
  }
  _lastId() { return this.prepare('SELECT last_insert_rowid() AS id').get().id; }
  prepare(sql) { return new Statement(this, sql); }
  exec(sql) { this.raw.exec(sql); return this; }
  pragma(p) { try { this.raw.exec(`PRAGMA ${p}`); } catch {} }
  transaction(fn) {
    return (...args) => {
      const name = `sp${this.depth++}`;
      this.raw.exec(`SAVEPOINT ${name}`);
      try {
        const r = fn(...args);
        this.raw.exec(`RELEASE ${name}`);
        return r;
      } catch (e) {
        this.raw.exec(`ROLLBACK TO ${name}`); this.raw.exec(`RELEASE ${name}`);
        throw e;
      } finally { this.depth--; }
    };
  }
  export() {
    for (const s of this.cache.values()) { try { s.free(); } catch {} }
    this.cache.clear();
    return this.raw.export();
  }
}

module.exports = Database;
