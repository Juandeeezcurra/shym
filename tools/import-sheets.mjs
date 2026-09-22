// ============================================================
// SHYM — IMPORT DEL EXPORT DE SHEETS A D1
// ============================================================
//   node tools/import-sheets.mjs --local   [--file shymie-export.json]
//   node tools/import-sheets.mjs --remote
//
// Lee el JSON que devuelve exportAll(), lo convierte a SQL y lo aplica con
// wrangler. Es idempotente: arranca borrando las tablas, asi que se puede
// correr las veces que haga falta mientras se prueba la migracion.
// ============================================================

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { COLUMNS, TABLE_OF, SHEET_NAMES, T } from '../src/schema.js';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const local = args.includes('--local');
const fileArg = args.indexOf('--file');
const file = fileArg >= 0 ? args[fileArg + 1] : 'shymie-export.json';
const dryRun = args.includes('--dry-run');

if (!remote && !local && !dryRun) {
  console.error('Falta --local o --remote (o --dry-run para solo generar el SQL).');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No existe ${file}. Corre exportAll() en Apps Script primero.`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
// exportAll() se llama via la API, que envuelve en { ok, result }.
const data = raw.result || raw;
if (!data.tables) {
  console.error('El JSON no tiene .tables. Revisa que sea la salida de exportAll().');
  process.exit(1);
}

function sqlLiteral(value, type) {
  if (value === undefined || value === null || value === '') return 'NULL';
  if (type === T.BOOL) {
    return (value === true || value === 'TRUE' || value === 'true' || value === 1) ? '1' : '0';
  }
  if (type === T.NUM) {
    const n = Number(value);
    return isNaN(n) ? 'NULL' : String(n);
  }
  return "'" + String(value).replace(/'/g, "''") + "'";
}

const stmts = [];
const counts = {};

// Orden inverso al de dependencias no hace falta: no hay foreign keys, pero
// se limpia todo antes para que el import sea repetible.
for (const name of SHEET_NAMES) {
  stmts.push(`DELETE FROM ${TABLE_OF[name]};`);
}
stmts.push('DELETE FROM settings;');

for (const name of SHEET_NAMES) {
  const rows = data.tables[name] || [];
  counts[name] = rows.length;
  if (!rows.length) continue;
  const cols = COLUMNS[name];
  const colNames = Object.keys(cols);
  // INSERT multi-fila en tandas, para no generar una sentencia gigante.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk
      .map(row => '(' + colNames.map(c => sqlLiteral(row[c], cols[c])).join(', ') + ')')
      .join(',\n  ');
    stmts.push(`INSERT INTO ${TABLE_OF[name]} (${colNames.join(', ')}) VALUES\n  ${values};`);
  }
}

for (const [key, value] of Object.entries(data.settings || {})) {
  stmts.push(`INSERT INTO settings (key, value) VALUES ('${key}', '${String(value).replace(/'/g, "''")}');`);
}

const sql = stmts.join('\n\n') + '\n';
const outFile = '.wrangler/shymie-import.sql';
fs.mkdirSync('.wrangler', { recursive: true });
fs.writeFileSync(outFile, sql);

console.log('Filas por tabla:');
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(18)} ${v}`);
console.log(`\nSQL generado: ${outFile} (${stmts.length} sentencias)`);

if (data.timezone) console.log(`Zona horaria del Sheet origen: ${data.timezone}`);

if (dryRun) {
  console.log('\n--dry-run: no se aplico nada.');
  process.exit(0);
}

const target = remote ? '--remote' : '--local';
console.log(`\nAplicando a D1 (${target})...`);
// shell:true porque en Windows 'npx' es npx.cmd y execFileSync no lo resuelve solo.
execFileSync('npx', ['wrangler', 'd1', 'execute', 'shymie', target, '--file', outFile, '--yes'], {
  stdio: 'inherit',
  shell: true,
});
console.log('Import completo.');
