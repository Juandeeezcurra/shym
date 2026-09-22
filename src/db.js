// ============================================================
// SHYM — CAPA DE DATOS (D1)
// ============================================================
// Reemplaza a la capa de Google Sheets manteniendo las MISMAS firmas
// sincronas, para que las ~4.700 lineas de logica de negocio portadas desde
// Code.gs funcionen sin tocarlas.
//
// D1 es asincrono y la logica de negocio es sincrona de punta a punta. El
// puente es un ciclo de tres tiempos por request:
//
//   1. load()   -> una sola lectura que trae las tablas a memoria.
//   2. logica   -> corre sincrona: las lecturas salen de memoria y las
//                  escrituras mutan memoria y se encolan.
//   3. flush()  -> manda la cola en un unico d1.batch(), que D1 corre como
//                  transaccion. O entra todo o no entra nada.
//
// Esto ademas mejora la consistencia respecto de Sheets, donde cada
// appendRow_/deleteRow era una escritura suelta sin transaccion. Por eso el
// port no necesita LockService: el batch da atomicidad dentro del request.
// ============================================================

import { COLUMNS, HEADERS, TABLE_OF, PRIMARY_KEY, SHEET_NAMES, T } from './schema.js';

// Sheets devolvia '' para celda vacia. Respetarlo es obligatorio.
const EMPTY = '';

function fromSql(value, type) {
  if (value === null || value === undefined) return EMPTY;
  if (type === T.BOOL) return value === 1 || value === '1' || value === true;
  if (type === T.NUM) {
    if (value === EMPTY) return EMPTY;
    const n = Number(value);
    return isNaN(n) ? EMPTY : n;
  }
  return value;
}

function toSql(value, type) {
  if (value === undefined || value === null || value === EMPTY) return null;
  if (type === T.BOOL) {
    if (value === true || value === 'TRUE' || value === 'true' || value === 1) return 1;
    return 0;
  }
  if (type === T.NUM) {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  return value.toString();
}

export class Store {
  constructor(d1) {
    this.d1 = d1;
    this.rows = {};        // nombre logico -> array de filas en forma Sheets
    this.pending = [];     // sentencias D1 encoladas
    this.dirty = new Set();
    this.loaded = false;
    this.settings = {};
  }

  // ---------- 1. LOAD ----------

  // Trae todo a memoria de una. El dataset de un log de entrenamiento personal
  // son unos pocos miles de filas, asi que una lectura completa es mas barata y
  // mucho menos fragil que mapear que tablas necesita cada uno de los 50
  // endpoints: si a ese mapa le falta una tabla, el bug es silencioso y da una
  // respuesta incorrecta en vez de un error.
  async load() {
    if (this.loaded) return;
    const stmts = SHEET_NAMES.map(name =>
      this.d1.prepare(`SELECT * FROM ${TABLE_OF[name]} ORDER BY _seq`)
    );
    stmts.push(this.d1.prepare('SELECT key, value FROM settings'));
    const results = await this.d1.batch(stmts);

    SHEET_NAMES.forEach((name, i) => {
      const cols = COLUMNS[name];
      this.rows[name] = (results[i].results || []).map(raw => {
        const obj = {};
        for (const [col, type] of Object.entries(cols)) {
          obj[col] = fromSql(raw[col], type);
        }
        obj._seq = raw._seq;
        return obj;
      });
    });

    for (const row of results[results.length - 1].results || []) {
      this.settings[row.key] = row.value;
    }
    this.loaded = true;
  }

  // ---------- 2. LECTURA / ESCRITURA SINCRONA ----------

  // Copia defensiva, igual que hacia la version de Sheets: la logica de negocio
  // muta libremente las filas que recibe y no debe ensuciar la cache.
  readAll(name) {
    const rows = this.rows[name];
    if (!rows) throw new Error(`Tabla "${name}" no existe.`);
    return rows.map(row => ({ ...row }));
  }

  appendRow(name, obj) {
    return this.appendRows(name, [obj])[0];
  }

  appendRows(name, objects) {
    const items = objects || [];
    if (!items.length) return [];
    const cols = COLUMNS[name];
    const colNames = Object.keys(cols);
    const table = TABLE_OF[name];
    const placeholders = colNames.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${colNames.join(', ')}) VALUES (${placeholders})`;

    for (const obj of items) {
      const values = colNames.map(c => toSql(obj[c], cols[c]));
      this.pending.push(this.d1.prepare(sql).bind(...values));
      // Espeja en memoria en forma Sheets, para que lo que se lea despues en
      // este mismo request vea la fila recien escrita (igual que Sheets, donde
      // appendRow_ invalidaba la cache y la relectura la incluia).
      const mirrored = {};
      colNames.forEach((c, i) => { mirrored[c] = fromSql(values[i], cols[c]); });
      this.rows[name].push(mirrored);
    }
    this.dirty.add(name);
    return items;
  }

  updateRowById(name, idCol, idValue, partial) {
    const cols = COLUMNS[name];
    const rows = this.rows[name];
    const idx = rows.findIndex(r => r[idCol] === idValue);
    if (idx < 0) throw new Error('No se encontro ' + idCol + '=' + idValue + ' en ' + name);

    const current = rows[idx];
    const updated = {};
    for (const col of Object.keys(cols)) {
      updated[col] = partial[col] !== undefined ? partial[col] : current[col];
    }

    const setCols = Object.keys(cols);
    const sql = `UPDATE ${TABLE_OF[name]} SET ${setCols.map(c => `${c} = ?`).join(', ')} WHERE ${idCol} = ?`;
    const values = setCols.map(c => toSql(updated[c], cols[c]));
    this.pending.push(this.d1.prepare(sql).bind(...values, toSql(idValue, cols[idCol])));

    const mirrored = { _seq: current._seq };
    setCols.forEach((c, i) => { mirrored[c] = fromSql(values[i], cols[c]); });
    rows[idx] = mirrored;
    this.dirty.add(name);
    return { ...mirrored };
  }

  deleteRowById(name, idCol, idValue) {
    const rows = this.rows[name];
    const idx = rows.findIndex(r => r[idCol] === idValue);
    if (idx < 0) return false;
    const cols = COLUMNS[name];
    this.pending.push(
      this.d1.prepare(`DELETE FROM ${TABLE_OF[name]} WHERE ${idCol} = ?`)
        .bind(toSql(idValue, cols[idCol]))
    );
    rows.splice(idx, 1);
    this.dirty.add(name);
    return true;
  }

  deleteRowsWhere(name, predicate) {
    const rows = this.rows[name];
    const pk = PRIMARY_KEY[name];
    const cols = COLUMNS[name];
    const doomed = rows.filter(predicate);
    if (!doomed.length) return 0;
    for (const row of doomed) {
      this.pending.push(
        this.d1.prepare(`DELETE FROM ${TABLE_OF[name]} WHERE ${pk} = ?`)
          .bind(toSql(row[pk], cols[pk]))
      );
    }
    const doomedSet = new Set(doomed.map(r => r[pk]));
    this.rows[name] = rows.filter(r => !doomedSet.has(r[pk]));
    this.dirty.add(name);
    return doomed.length;
  }

  // Reemplaza a PropertiesService.
  getSetting(key) {
    const v = this.settings[key];
    return v === undefined ? null : v;
  }

  setSetting(key, value) {
    this.settings[key] = String(value);
    this.pending.push(
      this.d1.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        .bind(key, String(value))
    );
  }

  // ---------- 3. FLUSH ----------

  hasWrites() {
    return this.pending.length > 0;
  }

  async flush() {
    if (!this.pending.length) return 0;
    const batch = this.pending;
    this.pending = [];
    await this.d1.batch(batch);
    return batch.length;
  }
}

export { HEADERS, SHEET_NAMES };
