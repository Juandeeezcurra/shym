// ============================================================
// D1 falso sobre el SQLite nativo de Node (node:sqlite)
// ============================================================
// Implementa la superficie de D1 que usa src/db.js (prepare/bind/batch) para
// poder probar la logica portada en Node, sin levantar Cloudflare.
// Solo para tests: en produccion corre el D1 real.
// ============================================================

import { DatabaseSync } from 'node:sqlite';

class FakeStatement {
  constructor(db, sql, values = []) {
    this.db = db;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) {
    return new FakeStatement(this.db, this.sql, values);
  }
  run() {
    const stmt = this.db.prepare(this.sql);
    if (/^\s*select/i.test(this.sql)) {
      return { results: stmt.all(...this.values), success: true };
    }
    stmt.run(...this.values);
    return { results: [], success: true };
  }
}

export class FakeD1 {
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
  }
  prepare(sql) {
    return new FakeStatement(this.db, sql);
  }
  // D1 corre el batch como una transaccion. Se replica para que los tests
  // ejerciten el mismo comportamiento de todo-o-nada.
  async batch(stmts) {
    const readOnly = stmts.every(s => /^\s*select/i.test(s.sql));
    if (readOnly) return stmts.map(s => s.run());
    this.db.exec('BEGIN');
    try {
      const out = stmts.map(s => s.run());
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
  exec(sql) {
    this.db.exec(sql);
  }
}
