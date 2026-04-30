// ============================================================
// GYM TRACKER — GOOGLE APPS SCRIPT
// ============================================================
// Setup:
//   1. Crea un Google Sheets vacio.
//   2. Extensions > Apps Script. Pega Code.gs y Index.html.
//   3. Corre setup() una vez (boton Run).
//   4. Deploy > New deployment > Web app > Execute as: Me, Access: Only myself.
//   5. Abri la URL en el celular.
// ============================================================
// Single-user. Pesos guardados siempre en kg (toggle kg/lb es solo display).
// ============================================================

const SHEETS = {
  ROUTINES: 'Routines',
  DAYS: 'Routine_Days',
  EXERCISES: 'Day_Exercises',
  SESSIONS: 'Sessions',
  SETS: 'Session_Sets',
};

const HEADERS = {
  [SHEETS.ROUTINES]: [
    'routine_id', 'routine_name', 'created_at', 'is_active'
  ],
  [SHEETS.DAYS]: [
    'day_id', 'routine_id', 'day_name', 'day_order'
  ],
  [SHEETS.EXERCISES]: [
    'routine_exercise_id', 'day_id', 'exercise_order', 'exercise_name',
    'target_sets', 'target_reps_min', 'target_reps_max',
    'suggested_weight', 'technique_note'
  ],
  [SHEETS.SESSIONS]: [
    'session_id', 'date', 'routine_id', 'day_id',
    'bodyweight', 'notes', 'created_at'
  ],
  [SHEETS.SETS]: [
    'set_id', 'session_id', 'routine_exercise_id', 'exercise_name',
    'set_number', 'weight', 'reps', 'rir', 'note'
  ],
};

// ============================================================
// WEB ENTRY
// ============================================================

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Gym Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, user-scalable=no')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// SETUP — corre esto una vez despues de pegar el script
// ============================================================

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Bind este script a un Google Sheets primero.');

  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = HEADERS[name];
    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#111519')
      .setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  });

  // Borra la sheet por defecto si esta vacia y existe
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Hoja 1') || ss.getSheetByName('Hoja1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  return 'Sheets listas: ' + Object.values(SHEETS).join(', ');
}

// ============================================================
// HELPERS GENERICOS
// ============================================================

function getSheet_(name) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" no existe. Corre setup() primero.');
  return sh;
}

function readAll_(name) {
  const sh = getSheet_(name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

function appendRow_(name, obj) {
  const sh = getSheet_(name);
  const headers = HEADERS[name];
  const row = headers.map(h => (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '');
  sh.appendRow(row);
  return obj;
}

function findRowIndex_(sh, name, idCol, idValue) {
  const headers = HEADERS[name];
  const colIdx = headers.indexOf(idCol);
  if (colIdx < 0) throw new Error('Columna "' + idCol + '" no existe en ' + name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === idValue) return i + 2;
  }
  return -1;
}

function updateRowById_(name, idCol, idValue, partial) {
  const sh = getSheet_(name);
  const rowIdx = findRowIndex_(sh, name, idCol, idValue);
  if (rowIdx < 0) throw new Error('No se encontro ' + idCol + '=' + idValue + ' en ' + name);
  const headers = HEADERS[name];
  const current = sh.getRange(rowIdx, 1, 1, headers.length).getValues()[0];
  const updated = headers.map((h, i) => partial[h] !== undefined ? partial[h] : current[i]);
  sh.getRange(rowIdx, 1, 1, headers.length).setValues([updated]);
  const obj = {};
  headers.forEach((h, i) => { obj[h] = updated[i]; });
  return obj;
}

function deleteRowById_(name, idCol, idValue) {
  const sh = getSheet_(name);
  const rowIdx = findRowIndex_(sh, name, idCol, idValue);
  if (rowIdx < 0) return false;
  sh.deleteRow(rowIdx);
  return true;
}

function deleteRowsWhere_(name, predicate) {
  const sh = getSheet_(name);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  const headers = HEADERS[name];
  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let removed = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = values[i][j]; });
    if (predicate(obj)) {
      sh.deleteRow(i + 2);
      removed++;
    }
  }
  return removed;
}

function genId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function nowIso_() {
  return new Date().toISOString();
}

function todayIso_() {
  const tz = Session.getScriptTimeZone() || 'UTC';
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}

function isTrue_(v) {
  return v === true || v === 'TRUE' || v === 'true' || v === 1;
}

// ============================================================
// PING — usado por el frontend para verificar conexion
// ============================================================

function ping() {
  return { ok: true, time: nowIso_(), today: todayIso_() };
}

// ============================================================
// ROUTINES API
// ============================================================

function listRoutines() {
  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const exercises = readAll_(SHEETS.EXERCISES);

  return routines
    .map(r => {
      const rDays = days.filter(d => d.routine_id === r.routine_id);
      const dayIds = rDays.map(d => d.day_id);
      const exCount = exercises.filter(e => dayIds.indexOf(e.day_id) >= 0).length;
      return {
        routine_id: r.routine_id,
        routine_name: r.routine_name,
        created_at: r.created_at,
        is_active: isTrue_(r.is_active),
        day_count: rDays.length,
        exercise_count: exCount,
      };
    })
    .sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });
}

function createRoutine(name) {
  name = (name || '').toString().trim();
  if (!name) throw new Error('El nombre no puede estar vacio.');
  if (name.length > 80) throw new Error('Nombre demasiado largo (max 80 caracteres).');

  const existing = readAll_(SHEETS.ROUTINES);
  const isFirst = existing.length === 0;

  const routine = {
    routine_id: genId_('r'),
    routine_name: name,
    created_at: nowIso_(),
    is_active: isFirst,
  };
  appendRow_(SHEETS.ROUTINES, routine);
  return Object.assign({}, routine, { day_count: 0, exercise_count: 0 });
}

function renameRoutine(routine_id, new_name) {
  new_name = (new_name || '').toString().trim();
  if (!new_name) throw new Error('El nombre no puede estar vacio.');
  if (new_name.length > 80) throw new Error('Nombre demasiado largo.');
  return updateRowById_(SHEETS.ROUTINES, 'routine_id', routine_id, { routine_name: new_name });
}

function setActiveRoutine(routine_id) {
  const sh = getSheet_(SHEETS.ROUTINES);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('No hay rutinas.');
  const headers = HEADERS[SHEETS.ROUTINES];
  const idCol = headers.indexOf('routine_id') + 1;
  const activeCol = headers.indexOf('is_active') + 1;
  const ids = sh.getRange(2, idCol, lastRow - 1, 1).getValues();
  let found = false;
  const updates = ids.map(row => {
    const match = row[0] === routine_id;
    if (match) found = true;
    return [match];
  });
  if (!found) throw new Error('Rutina no encontrada: ' + routine_id);
  sh.getRange(2, activeCol, lastRow - 1, 1).setValues(updates);
  return { ok: true, routine_id: routine_id };
}

function deleteRoutine(routine_id) {
  const days = readAll_(SHEETS.DAYS).filter(d => d.routine_id === routine_id);
  const dayIds = days.map(d => d.day_id);
  if (dayIds.length > 0) {
    deleteRowsWhere_(SHEETS.EXERCISES, e => dayIds.indexOf(e.day_id) >= 0);
    deleteRowsWhere_(SHEETS.DAYS, d => d.routine_id === routine_id);
  }
  const ok = deleteRowById_(SHEETS.ROUTINES, 'routine_id', routine_id);

  // Si la borrada era la activa, activa la primera disponible
  const remaining = readAll_(SHEETS.ROUTINES);
  if (remaining.length > 0 && !remaining.some(r => isTrue_(r.is_active))) {
    setActiveRoutine(remaining[0].routine_id);
  }
  return { ok: ok };
}

function getRoutine(routine_id) {
  const routines = readAll_(SHEETS.ROUTINES);
  const r = routines.find(x => x.routine_id === routine_id);
  if (!r) throw new Error('Rutina no encontrada.');

  const days = readAll_(SHEETS.DAYS)
    .filter(d => d.routine_id === routine_id)
    .sort((a, b) => Number(a.day_order || 0) - Number(b.day_order || 0));

  const exercises = readAll_(SHEETS.EXERCISES);
  const dayIds = days.map(d => d.day_id);

  const result = days.map(d => ({
    day_id: d.day_id,
    day_name: d.day_name,
    day_order: Number(d.day_order || 0),
    exercises: exercises
      .filter(e => e.day_id === d.day_id)
      .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0))
      .map(e => ({
        routine_exercise_id: e.routine_exercise_id,
        exercise_order: Number(e.exercise_order || 0),
        exercise_name: e.exercise_name,
        target_sets: Number(e.target_sets || 0),
        target_reps_min: Number(e.target_reps_min || 0),
        target_reps_max: Number(e.target_reps_max || 0),
        suggested_weight: e.suggested_weight === '' ? null : Number(e.suggested_weight),
        technique_note: e.technique_note || '',
      })),
  }));

  return {
    routine_id: r.routine_id,
    routine_name: r.routine_name,
    created_at: r.created_at,
    is_active: isTrue_(r.is_active),
    days: result,
  };
}
