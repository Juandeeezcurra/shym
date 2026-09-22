// ============================================================
// Transforma Code.gs (Apps Script) -> src/api.js (Worker, ES module)
// ============================================================
// Se hace por script y no a mano para que el port de ~4.800 lineas sea
// reproducible y auditable: si Code.gs cambia, se vuelve a correr.
//
// Estrategia: partir el archivo en bloques top-level, descartar los que
// reemplazan las capas nuevas (schema/db/platform/worker) y dejar el resto
// intacto. La logica de negocio NO se toca.
// ============================================================

import fs from 'node:fs';

const SRC = 'Code.gs';
const OUT = 'src/api.js';

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');

// --- 1. Partir en bloques top-level -------------------------------------
// Code.gs esta formateado consistentemente: toda declaracion top-level
// arranca en la columna 0 y cierra con `}` o `};` tambien en columna 0.
// Partir por eso evita tener que hacer brace-matching, que se rompe con las
// llaves dentro de regex como /^\d{4}-\d{2}-\d{2}$/.
const START = /^(?:function\s+([A-Za-z0-9_$]+)|(?:const|let|var)\s+([A-Za-z0-9_$]+))/;

const blocks = [];
let current = null;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(START);
  if (m) {
    if (current) blocks.push(current);
    current = { name: m[1] || m[2], start: i, lines: [] };
  }
  if (!current) {
    current = { name: null, start: i, lines: [] }; // preambulo
  }
  current.lines.push(lines[i]);
}
if (current) blocks.push(current);

// --- 2. Validar que cada bloque cierre limpio ----------------------------
const suspicious = [];
for (const b of blocks) {
  if (!b.name) continue;
  const body = b.lines.join('\n');
  // Contar llaves ignorando strings, comentarios y regex de forma conservadora.
  let depth = 0, ok = true;
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/\/(?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\\\n])+\/[gimsuy]*/g, 'RE');
  for (const ch of stripped) {
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth < 0) { ok = false; break; } }
  }
  if (!ok || depth !== 0) suspicious.push(`${b.name} (depth=${depth})`);
}

// --- 3. Bloques a descartar ----------------------------------------------
const DROP = new Set([
  // Reemplazados por src/schema.js
  'SHEETS', 'HEADERS',
  // Reemplazados por src/db.js
  'READ_CACHE_', 'getSheet_', 'ensureSheet_', 'sheetExists_', 'readAll_',
  'invalidateReadCache_', 'appendRow_', 'appendRows_', 'findRowIndex_',
  'updateRowById_', 'deleteRowById_', 'deleteRowsWhere_',
  // Reemplazados por src/platform.js
  'genId_', 'nowIso_', 'todayIso_', 'isTrue_',
  // Reemplazados por src/index.js (el Worker hace routing y respuesta)
  'doGet', 'doPost', 'runApiCall_', 'json_', 'getApi_',
  // Cache de servidor: se elimina en v1. Existia porque Apps Script tardaba
  // 1-3s por llamada; D1 responde en decenas de ms y la cache solo agregaba
  // staleness. El cache de localStorage del frontend se mantiene.
  'READ_API_CACHE_SECONDS_', 'WRITE_API_', 'API_SHAPE_VERSION_',
  'apiCacheKey_', 'putApiCache_', 'bumpApiCacheVersion_',
  // Reescritos a mano mas abajo (tocaban el Sheet o Properties directo)
  'setup', 'migrateHistoricalSnapshots', 'setActiveRoutine', 'normalizeDate_',
  'getNutritionTargetKcal_', 'setNutritionTargetKcal_',
  'findNutritionRowIndex_', 'writeNutritionRow_',
  // Herramienta de migracion unica: vive solo en Apps Script, no en el Worker.
  'exportAll',
]);

const kept = [];
const dropped = [];
for (const b of blocks) {
  if (b.name && DROP.has(b.name)) { dropped.push(b.name); continue; }
  if (!b.name) continue; // se descarta el preambulo (comentario de setup de Apps Script)
  kept.push(b);
}

const missing = [...DROP].filter(n => !dropped.includes(n));

// --- 4. Ensamblar src/api.js ---------------------------------------------
const header = `// ============================================================
// SHYM — LOGICA DE NEGOCIO
// ============================================================
// GENERADO por tools/port-code-gs.mjs desde Code.gs. No editar a mano:
// editar Code.gs o el script de port y volver a correrlo.
//
// Todo lo que hay aca abajo es la logica de negocio portada tal cual desde
// Apps Script. Lo especifico de Google vive en las capas nuevas:
//   - datos            -> src/db.js    (D1 con las mismas firmas sincronas)
//   - uuid/fecha/TZ    -> src/platform.js
//   - routing/auth     -> src/index.js
//   - modelo de datos  -> src/schema.js
// ============================================================

import { SHEETS, HEADERS } from './schema.js';
import { genId_, nowIso_, todayIso_, isTrue_, formatDateIso } from './platform.js';

// El Store del request en curso. Lo setea el Worker antes de invocar la API.
let DB = null;
export function setStore(store) { DB = store; }

// Puentes a la capa de datos, con las firmas identicas a las de Apps Script
// para que la logica de negocio de abajo no necesite ningun cambio.
function readAll_(name) { return DB.readAll(name); }
function appendRow_(name, obj) { return DB.appendRow(name, obj); }
function appendRows_(name, objects) { return DB.appendRows(name, objects); }
function updateRowById_(name, idCol, idValue, partial) { return DB.updateRowById(name, idCol, idValue, partial); }
function deleteRowById_(name, idCol, idValue) { return DB.deleteRowById(name, idCol, idValue); }
function deleteRowsWhere_(name, predicate) { return DB.deleteRowsWhere(name, predicate); }
function invalidateReadCache_() { /* la cache vive en el Store, no hace falta */ }

// Shim no-op de LockService. En Sheets el lock protegia secuencias de
// escrituras sueltas. Ahora cada request acumula sus escrituras y las manda
// en un unico d1.batch(), que D1 corre como transaccion, asi que la
// atomicidad ya esta cubierta. El shim evita reestructurar los try/finally
// de las 6 funciones que lo usaban.
const LockService = {
  getScriptLock: () => ({ waitLock() {}, releaseLock() {} }),
};

// ============================================================
// REESCRITOS: tocaban el Sheet o PropertiesService directamente
// ============================================================

// Antes escribia la columna is_active de todas las filas de una pasada con
// setValues. Ahora es un update por fila, que el Store agrupa en el batch.
function setActiveRoutine(routine_id) {
  const routines = readAll_(SHEETS.ROUTINES);
  if (!routines.length) throw new Error('No hay rutinas.');
  if (!routines.some(r => r.routine_id === routine_id)) {
    throw new Error('Rutina no encontrada: ' + routine_id);
  }
  routines.forEach(r => {
    const shouldBeActive = r.routine_id === routine_id;
    if (isTrue_(r.is_active) !== shouldBeActive) {
      updateRowById_(SHEETS.ROUTINES, 'routine_id', r.routine_id, { is_active: shouldBeActive });
    }
  });
  return { ok: true, routine_id: routine_id };
}

// Antes: Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd').
function normalizeDate_(value) {
  if (!value) return todayIso_();
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return formatDateIso(value);
  }
  const s = value.toString().trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('Fecha invalida.');
  return formatDateIso(d);
}

// Antes: PropertiesService. Ahora la tabla settings de D1, que ademas es
// durable y entra en la misma transaccion que el resto del request.
function getNutritionTargetKcal_() {
  const stored = DB.getSetting('nutrition_target_kcal');
  const n = Number(stored);
  return stored && !isNaN(n) && n > 0 ? n : NUTRITION_DEFAULT_KCAL_TARGET_;
}

function setNutritionTargetKcal_(value) {
  DB.setSetting('nutrition_target_kcal', String(value));
}

// El schema lo crean las migraciones de D1 (migrations/), asi que setup() ya
// no tiene que crear tablas. Queda solo el backfill historico.
function migrateHistoricalSnapshots() {
  return migrateHistoricalSnapshots_();
}

// En Sheets las tablas podian no existir hasta correr setup(), y algunos
// endpoints las creaban al vuelo o toleraban su ausencia. En D1 las crean las
// migraciones, asi que siempre existen: uno es constante y el otro no-op.
function sheetExists_(name) {
  return Object.prototype.hasOwnProperty.call(HEADERS, name);
}

function ensureSheet_(/* name */) { /* las migraciones ya crearon la tabla */ }

// El upsert de nutricion tenia su propio lookup porque Sheets devolvia la
// columna date como objeto Date y el === estricto de updateRowById_ nunca
// matcheaba contra el string 'yyyy-MM-dd'. En D1 la fecha es TEXT siempre, asi
// que ese motivo desaparece. Se conservan las firmas para no tocar
// saveNutritionDay: findNutritionRowIndex_ devuelve indice+1 (>0 si existe).
function findNutritionRowIndex_(date) {
  const rows = readAll_(SHEETS.NUTRITION);
  for (let i = 0; i < rows.length; i++) {
    if (normalizeDate_(rows[i].date) === date) return i + 1;
  }
  return -1;
}

function writeNutritionRow_(rowIndex, partial) {
  const rows = readAll_(SHEETS.NUTRITION);
  const current = rows[rowIndex - 1];
  if (!current) throw new Error('Fila de nutricion no encontrada.');
  return updateRowById_(SHEETS.NUTRITION, 'date', current.date, partial);
}

`;

const footer = `
// ============================================================
// SUPERFICIE PUBLICA DE LA API
// ============================================================
// Equivale al getApi_() de Apps Script: solo estas funciones son invocables
// desde el frontend.
export const API = {
  ping,
  listRoutines,
  createRoutine,
  renameRoutine,
  duplicateRoutine,
  setActiveRoutine,
  deleteRoutine,
  getRoutine,
  addDay,
  renameDay,
  updateDayWeekDays,
  deleteDay,
  reorderDay,
  addExercise,
  updateExercise,
  deleteExercise,
  reorderExercise,
  listExerciseLibrary,
  createLibraryExercise,
  updateLibraryExercise,
  deleteLibraryExercise,
  importRoutineExercisesToLibrary,
  getActiveRoutine,
  getTrainPickData,
  getLastSessionForDay,
  saveSession,
  getSession,
  editSession,
  deleteSession,
  getHomeStats,
  getWeekActivity,
  getHistoryData,
  listRecentSessions,
  listSessionDates,
  listBodyweightHistory,
  listAllExerciseNames,
  getProgressExerciseData,
  getProgressSummary,
  listExerciseHistory,
  listMuscleGroupHistory,
  getVolumeByMuscle,
  getMuscleHeatmap,
  getExerciseGoal,
  setExerciseGoal,
  migrateHistoricalSnapshots,
  saveNutritionDay,
  getNutritionDay,
  listNutritionHistory,
  getWeeklyAdjustment,
  getNutritionHomeStats,
  getPerformanceReport,
};

// Endpoints que escriben. El Worker los usa para decidir si hace flush.
export const WRITE_API = new Set([
  'createRoutine', 'renameRoutine', 'duplicateRoutine', 'setActiveRoutine',
  'deleteRoutine', 'addDay', 'renameDay', 'updateDayWeekDays', 'deleteDay',
  'reorderDay', 'addExercise', 'updateExercise', 'deleteExercise',
  'reorderExercise', 'createLibraryExercise', 'updateLibraryExercise',
  'deleteLibraryExercise', 'importRoutineExercisesToLibrary', 'saveSession',
  'editSession', 'deleteSession', 'setExerciseGoal',
  'migrateHistoricalSnapshots', 'saveNutritionDay',
]);
`;

const body = kept.map(b => b.lines.join('\n').replace(/\s+$/, '')).join('\n\n');
fs.writeFileSync(OUT, header + body + '\n' + footer);

// --- 5. Chequeo estatico de referencias colgadas --------------------------
// El riesgo principal del port es que una funcion conservada siga llamando a
// un helper que se elimino (p.ej. getSheet_). Eso explota recien en runtime y
// solo si el test toca ese camino, asi que se verifica aca de forma estatica.
const generated = fs.readFileSync(OUT, 'utf8');
const code = generated
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/"(?:\\.|[^"\\])*"/g, '""')
  .replace(/`(?:\\.|[^`\\])*`/g, '``');

// Todo lo que se define o importa en el archivo generado.
const defined = new Set();
for (const m of code.matchAll(/(?:^|\n)\s*function\s+([A-Za-z0-9_$]+)/g)) defined.add(m[1]);
for (const m of code.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) defined.add(m[1]);
for (const m of code.matchAll(/import\s*\{([^}]*)\}/g)) {
  for (const part of m[1].split(',')) {
    const n = part.trim().split(/\s+as\s+/).pop().trim();
    if (n) defined.add(n);
  }
}

// Convencion del proyecto: los helpers privados terminan en '_'. Alcanza con
// verificar esos, que son justamente los que se reemplazaron.
const called = new Set();
for (const m of code.matchAll(/([A-Za-z0-9$][A-Za-z0-9_$]*_)\s*\(/g)) called.add(m[1]);

const dangling = [...called].filter(n => !defined.has(n)).sort();

// --- 6. Reporte ----------------------------------------------------------
console.log(`bloques top-level detectados : ${blocks.filter(b => b.name).length}`);
console.log(`descartados (reemplazados)   : ${dropped.length}`);
console.log(`conservados (logica intacta) : ${kept.length}`);
if (missing.length) console.log(`AVISO no encontrados en Code.gs: ${missing.join(', ')}`);
if (suspicious.length) console.log(`AVISO bloques con llaves desbalanceadas: ${suspicious.join(', ')}`);
if (dangling.length) {
  console.log(`\nERROR referencias colgadas (helper llamado pero no definido):`);
  for (const n of dangling) console.log(`  - ${n}`);
  process.exitCode = 1;
} else {
  console.log('referencias colgadas         : ninguna');
}
console.log(`escrito: ${OUT}`);
