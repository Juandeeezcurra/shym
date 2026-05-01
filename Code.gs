// ============================================================
// GYM TRACKER — GOOGLE APPS SCRIPT
// ============================================================
// Setup:
//   1. Crea un Google Sheets vacio.
//   2. Extensions > Apps Script. Pega solo Code.gs.
//   3. Corre setup() una vez (boton Run).
//   4. Deploy > New deployment > Web app > Execute as: Me, Access: Anyone.
//   5. Abri la app en GitHub Pages y pega la URL /exec del deploy.
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
// WEB/API ENTRY
// ============================================================

function doGet() {
  return json_({
    ok: true,
    app: 'Gym Tracker API',
    message: 'Backend activo. Abrí la app desde GitHub Pages y configurá esta URL /exec.',
    time: nowIso_(),
  });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents
      ? JSON.parse(e.postData.contents)
      : {};
    const fn = (body.fn || '').toString();
    const args = Array.isArray(body.args) ? body.args : [];
    const api = getApi_();
    if (!api[fn]) throw new Error('Funcion API no permitida: ' + fn);
    return json_({ ok: true, result: api[fn].apply(null, args) });
  } catch (err) {
    return json_({
      ok: false,
      error: err && err.message ? err.message : String(err),
    });
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getApi_() {
  return {
    ping,
    listRoutines,
    createRoutine,
    renameRoutine,
    setActiveRoutine,
    deleteRoutine,
    getRoutine,
    addDay,
    renameDay,
    deleteDay,
    addExercise,
    updateExercise,
    deleteExercise,
    getActiveRoutine,
    getLastSessionForDay,
    saveSession,
    getSession,
  };
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

// ============================================================
// DAYS API — Parte 3
// ============================================================

function addDay(params) {
  const routine_id = (params.routine_id || '').toString().trim();
  const day_name   = (params.day_name   || '').toString().trim();
  if (!routine_id) throw new Error('routine_id requerido.');
  if (!day_name)   throw new Error('El nombre del día no puede estar vacío.');
  if (day_name.length > 50) throw new Error('Nombre demasiado largo (max 50 caracteres).');

  const routines = readAll_(SHEETS.ROUTINES);
  if (!routines.some(r => r.routine_id === routine_id)) throw new Error('Rutina no encontrada.');

  const existing  = readAll_(SHEETS.DAYS).filter(d => d.routine_id === routine_id);
  const nextOrder = existing.length > 0
    ? Math.max(...existing.map(d => Number(d.day_order || 0))) + 1
    : 1;

  appendRow_(SHEETS.DAYS, {
    day_id:     genId_('day'),
    routine_id,
    day_name,
    day_order:  nextOrder,
  });
  return getRoutine(routine_id);
}

function renameDay(params) {
  const day_id   = (params.day_id   || '').toString().trim();
  const new_name = (params.new_name || '').toString().trim();
  if (!day_id)   throw new Error('day_id requerido.');
  if (!new_name) throw new Error('El nombre no puede estar vacío.');
  if (new_name.length > 50) throw new Error('Nombre demasiado largo (max 50 caracteres).');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');
  updateRowById_(SHEETS.DAYS, 'day_id', day_id, { day_name: new_name });
  return getRoutine(day.routine_id);
}

function deleteDay(params) {
  const day_id = (params.day_id || '').toString().trim();
  if (!day_id) throw new Error('day_id requerido.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  deleteRowsWhere_(SHEETS.EXERCISES, e => e.day_id === day_id);
  deleteRowById_(SHEETS.DAYS, 'day_id', day_id);
  return getRoutine(day.routine_id);
}

// ============================================================
// EXERCISES API — Parte 3
// ============================================================

function addExercise(params) {
  const day_id        = (params.day_id        || '').toString().trim();
  const exercise_name = (params.exercise_name || '').toString().trim();
  const target_sets   = parseInt(params.target_sets,     10);
  const rmin          = parseInt(params.target_reps_min, 10);
  const rmax          = parseInt(params.target_reps_max, 10);
  const swRaw         = params.suggested_weight;
  const technique_note = (params.technique_note || '').toString().trim();

  if (!day_id)        throw new Error('day_id requerido.');
  if (!exercise_name) throw new Error('El nombre del ejercicio no puede estar vacío.');
  if (exercise_name.length > 100) throw new Error('Nombre demasiado largo (max 100 caracteres).');
  if (isNaN(target_sets) || target_sets < 1 || target_sets > 20) throw new Error('target_sets debe ser 1-20.');
  if (isNaN(rmin) || rmin < 1 || rmin > 100) throw new Error('target_reps_min debe ser 1-100.');
  if (isNaN(rmax) || rmax < 1 || rmax > 100) throw new Error('target_reps_max debe ser 1-100.');
  if (rmin > rmax) throw new Error('target_reps_min no puede ser mayor que target_reps_max.');

  let suggested_weight = '';
  if (swRaw !== undefined && swRaw !== null && swRaw !== '') {
    const n = Number(swRaw);
    if (isNaN(n) || n < 0) throw new Error('El peso sugerido debe ser ≥ 0.');
    suggested_weight = n;
  }

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  const existing  = readAll_(SHEETS.EXERCISES).filter(e => e.day_id === day_id);
  const nextOrder = existing.length > 0
    ? Math.max(...existing.map(e => Number(e.exercise_order || 0))) + 1
    : 1;

  appendRow_(SHEETS.EXERCISES, {
    routine_exercise_id: genId_('rex'),
    day_id,
    exercise_order:  nextOrder,
    exercise_name,
    target_sets,
    target_reps_min: rmin,
    target_reps_max: rmax,
    suggested_weight,
    technique_note,
  });
  return getRoutine(day.routine_id);
}

function updateExercise(params) {
  const rex_id = (params.routine_exercise_id || '').toString().trim();
  if (!rex_id) throw new Error('routine_exercise_id requerido.');

  const ex = readAll_(SHEETS.EXERCISES).find(e => e.routine_exercise_id === rex_id);
  if (!ex) throw new Error('Ejercicio no encontrado.');

  const partial = {};

  if (params.exercise_name !== undefined) {
    const name = params.exercise_name.toString().trim();
    if (!name) throw new Error('El nombre no puede estar vacío.');
    if (name.length > 100) throw new Error('Nombre demasiado largo (max 100 caracteres).');
    partial.exercise_name = name;
  }
  if (params.target_sets !== undefined) {
    const ts = parseInt(params.target_sets, 10);
    if (isNaN(ts) || ts < 1 || ts > 20) throw new Error('target_sets debe ser 1-20.');
    partial.target_sets = ts;
  }
  if (params.target_reps_min !== undefined || params.target_reps_max !== undefined) {
    const rmin = parseInt(params.target_reps_min !== undefined ? params.target_reps_min : ex.target_reps_min, 10);
    const rmax = parseInt(params.target_reps_max !== undefined ? params.target_reps_max : ex.target_reps_max, 10);
    if (isNaN(rmin) || rmin < 1 || rmin > 100) throw new Error('target_reps_min debe ser 1-100.');
    if (isNaN(rmax) || rmax < 1 || rmax > 100) throw new Error('target_reps_max debe ser 1-100.');
    if (rmin > rmax) throw new Error('target_reps_min no puede ser mayor que target_reps_max.');
    partial.target_reps_min = rmin;
    partial.target_reps_max = rmax;
  }
  if (params.suggested_weight !== undefined) {
    if (params.suggested_weight === '' || params.suggested_weight === null) {
      partial.suggested_weight = '';
    } else {
      const sw = Number(params.suggested_weight);
      if (isNaN(sw) || sw < 0) throw new Error('El peso sugerido debe ser ≥ 0.');
      partial.suggested_weight = sw;
    }
  }
  if (params.technique_note !== undefined) {
    partial.technique_note = params.technique_note.toString().trim();
  }

  updateRowById_(SHEETS.EXERCISES, 'routine_exercise_id', rex_id, partial);

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
  if (!day) throw new Error('Día no encontrado.');
  return getRoutine(day.routine_id);
}

function deleteExercise(params) {
  const rex_id = (params.routine_exercise_id || '').toString().trim();
  if (!rex_id) throw new Error('routine_exercise_id requerido.');

  const ex = readAll_(SHEETS.EXERCISES).find(e => e.routine_exercise_id === rex_id);
  if (!ex) throw new Error('Ejercicio no encontrado.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === ex.day_id);
  if (!day) throw new Error('Día no encontrado.');

  deleteRowById_(SHEETS.EXERCISES, 'routine_exercise_id', rex_id);
  return getRoutine(day.routine_id);
}

// ============================================================
// TRAINING API — Parte 4
// ============================================================

function normalizeDate_(value) {
  if (!value) return todayIso_();
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    const tz = Session.getScriptTimeZone() || 'UTC';
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  const s = value.toString().trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('Fecha invalida.');
  const tz = Session.getScriptTimeZone() || 'UTC';
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

function getActiveRoutine() {
  const active = readAll_(SHEETS.ROUTINES).find(r => isTrue_(r.is_active));
  if (!active) throw new Error('No hay rutina activa. Marcá una rutina como activa primero.');
  return getRoutine(active.routine_id);
}

function getLastSessionForDay(params) {
  params = params || {};
  const day_id = (params.day_id || '').toString().trim();
  const beforeDate = normalizeDate_(params.date);
  if (!day_id) throw new Error('day_id requerido.');

  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id);
  if (!day) throw new Error('Día no encontrado.');

  const exercises = readAll_(SHEETS.EXERCISES)
    .filter(e => e.day_id === day_id)
    .sort((a, b) => Number(a.exercise_order || 0) - Number(b.exercise_order || 0));
  const rexIds = exercises.map(e => e.routine_exercise_id);

  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(s => s.day_id === day_id && normalizeDate_(s.date) < beforeDate)
    .sort((a, b) => {
      const dateCmp = normalizeDate_(b.date).localeCompare(normalizeDate_(a.date));
      if (dateCmp !== 0) return dateCmp;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });

  const sets = readAll_(SHEETS.SETS);
  const result = {};

  rexIds.forEach(rexId => {
    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const sessionSets = sets
        .filter(set => set.session_id === session.session_id && set.routine_exercise_id === rexId)
        .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
        .map(set => ({
          set_number: Number(set.set_number || 0),
          weight: set.weight === '' ? null : Number(set.weight),
          reps: set.reps === '' ? null : Number(set.reps),
          rir: set.rir === '' ? null : Number(set.rir),
          note: set.note || '',
        }));
      if (sessionSets.length > 0) {
        result[rexId] = {
          session_id: session.session_id,
          date: normalizeDate_(session.date),
          sets: sessionSets,
        };
        break;
      }
    }
  });

  return result;
}

// ============================================================
// SESSIONS API — Parte 5
// ============================================================

function saveSession(params) {
  params = params || {};
  const date = normalizeDate_(params.date);
  const routine_id = (params.routine_id || '').toString().trim();
  const day_id = (params.day_id || '').toString().trim();
  if (!routine_id) throw new Error('routine_id requerido.');
  if (!day_id) throw new Error('day_id requerido.');

  const routine = readAll_(SHEETS.ROUTINES).find(r => r.routine_id === routine_id);
  if (!routine) throw new Error('Rutina no encontrada.');
  const day = readAll_(SHEETS.DAYS).find(d => d.day_id === day_id && d.routine_id === routine_id);
  if (!day) throw new Error('Día no encontrado en esta rutina.');

  const bodyweight = normalizeOptionalNumber_(params.bodyweight, 'bodyweight');
  const notes = (params.notes || '').toString().trim();
  const prepared = prepareSessionExercises_(params.exercises || []);
  if (prepared.setCount === 0) throw new Error('Cargá al menos una serie con peso o reps.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const session = appendRow_(SHEETS.SESSIONS, {
      session_id: genId_('ses'),
      date,
      routine_id,
      day_id,
      bodyweight: bodyweight === null ? '' : bodyweight,
      notes,
      created_at: nowIso_(),
    });

    prepared.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        appendRow_(SHEETS.SETS, {
          set_id: genId_('set'),
          session_id: session.session_id,
          routine_exercise_id: ex.routine_exercise_id,
          exercise_name: ex.exercise_name,
          set_number: set.set_number,
          weight: set.weight === null ? '' : set.weight,
          reps: set.reps === null ? '' : set.reps,
          rir: set.rir === null ? '' : set.rir,
          note: set.note || '',
        });
      });
    });

    const summary = buildSessionSummary_(session, prepared.exercises, routine, day);
    return { session, summary };
  } finally {
    lock.releaseLock();
  }
}

function getSession(params) {
  params = params || {};
  const session_id = (params.session_id || '').toString().trim();
  if (!session_id) throw new Error('session_id requerido.');

  const session = readAll_(SHEETS.SESSIONS).find(s => s.session_id === session_id);
  if (!session) throw new Error('Sesión no encontrada.');

  const routines = readAll_(SHEETS.ROUTINES);
  const days = readAll_(SHEETS.DAYS);
  const routine = routines.find(r => r.routine_id === session.routine_id) || {};
  const day = days.find(d => d.day_id === session.day_id) || {};
  const sets = readAll_(SHEETS.SETS)
    .filter(s => s.session_id === session_id)
    .sort((a, b) => {
      const nameCmp = (a.exercise_name || '').toString().localeCompare((b.exercise_name || '').toString());
      if (nameCmp !== 0) return nameCmp;
      return Number(a.set_number || 0) - Number(b.set_number || 0);
    });

  const grouped = {};
  sets.forEach(set => {
    const rexId = set.routine_exercise_id || set.exercise_name;
    if (!grouped[rexId]) {
      grouped[rexId] = {
        routine_exercise_id: set.routine_exercise_id,
        exercise_name: set.exercise_name,
        sets: [],
      };
    }
    grouped[rexId].sets.push({
      set_number: Number(set.set_number || 0),
      weight: set.weight === '' ? null : Number(set.weight),
      reps: set.reps === '' ? null : Number(set.reps),
      rir: set.rir === '' ? null : Number(set.rir),
      note: set.note || '',
    });
  });

  return {
    session_id: session.session_id,
    date: normalizeDate_(session.date),
    routine_id: session.routine_id,
    routine_name: routine.routine_name || '',
    day_id: session.day_id,
    day_name: day.day_name || '',
    bodyweight: session.bodyweight === '' ? null : Number(session.bodyweight),
    notes: session.notes || '',
    created_at: session.created_at,
    exercises: Object.keys(grouped).map(k => grouped[k]),
  };
}

function prepareSessionExercises_(items) {
  if (!Array.isArray(items)) throw new Error('exercises debe ser un array.');
  const routineExercises = readAll_(SHEETS.EXERCISES);
  const prepared = [];
  let setCount = 0;

  items.forEach(item => {
    const rexId = (item.routine_exercise_id || '').toString().trim();
    if (!rexId) return;
    const template = routineExercises.find(e => e.routine_exercise_id === rexId);
    const exerciseName = ((item.exercise_name || (template && template.exercise_name) || '') + '').trim();
    if (!exerciseName) throw new Error('Nombre de ejercicio requerido.');
    if (exerciseName.length > 100) throw new Error('Nombre de ejercicio demasiado largo.');

    const sets = [];
    (item.sets || []).forEach((rawSet, idx) => {
      const weight = normalizeOptionalNumber_(rawSet.weight, 'weight');
      const reps = normalizeOptionalInteger_(rawSet.reps, 'reps');
      const rir = normalizeOptionalInteger_(rawSet.rir, 'rir');
      const note = (rawSet.note || '').toString().trim();
      if (weight === null && reps === null) return;
      if (weight !== null && weight < 0) throw new Error('El peso no puede ser negativo.');
      if (reps !== null && (reps < 1 || reps > 100)) throw new Error('Las reps deben ser 1-100.');
      if (rir !== null && (rir < 0 || rir > 10)) throw new Error('RIR debe ser 0-10.');
      sets.push({
        set_number: Number(rawSet.set_number || idx + 1),
        weight,
        reps,
        rir,
        note,
      });
      setCount++;
    });

    if (sets.length > 0) {
      prepared.push({
        routine_exercise_id: rexId,
        exercise_name: exerciseName,
        template,
        sets,
      });
    }
  });

  return { exercises: prepared, setCount };
}

function normalizeOptionalNumber_(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) throw new Error(field + ' inválido.');
  return Math.round(n * 100) / 100;
}

function normalizeOptionalInteger_(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (isNaN(n)) throw new Error(field + ' inválido.');
  return Math.round(n);
}

function buildSessionSummary_(session, exercises, routine, day) {
  const exerciseSummaries = exercises.map(ex => {
    const previousSets = getPreviousSetsForExercise_(ex.routine_exercise_id, session.day_id, normalizeDate_(session.date));
    const currentMetrics = calcSetMetrics_(ex.sets);
    const previousMetrics = calcSetMetrics_(previousSets);
    const status = compareMetrics_(currentMetrics, previousMetrics, previousSets.length > 0);
    return {
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: ex.exercise_name,
      sets: ex.sets,
      previous_sets: previousSets,
      metrics: currentMetrics,
      previous_metrics: previousSets.length > 0 ? previousMetrics : null,
      status,
      suggestion: buildSuggestion_(ex.sets, ex.template),
    };
  });

  const totalVolume = exerciseSummaries.reduce((sum, ex) => sum + ex.metrics.volume, 0);
  const previousVolume = exerciseSummaries.reduce((sum, ex) => sum + (ex.previous_metrics ? ex.previous_metrics.volume : 0), 0);
  const delta = previousVolume > 0 ? Math.round(((totalVolume - previousVolume) / previousVolume) * 1000) / 10 : null;

  return {
    session_id: session.session_id,
    date: normalizeDate_(session.date),
    routine_id: session.routine_id,
    routine_name: routine.routine_name,
    day_id: session.day_id,
    day_name: day.day_name,
    total_volume: Math.round(totalVolume * 100) / 100,
    previous_volume: previousVolume > 0 ? Math.round(previousVolume * 100) / 100 : null,
    delta_percent: delta,
    exercises: exerciseSummaries,
  };
}

function getPreviousSetsForExercise_(rexId, dayId, beforeDate) {
  const sessions = readAll_(SHEETS.SESSIONS)
    .filter(s => s.day_id === dayId && normalizeDate_(s.date) < beforeDate)
    .sort((a, b) => {
      const dateCmp = normalizeDate_(b.date).localeCompare(normalizeDate_(a.date));
      if (dateCmp !== 0) return dateCmp;
      return (b.created_at || '').toString().localeCompare((a.created_at || '').toString());
    });
  const sets = readAll_(SHEETS.SETS);

  for (let i = 0; i < sessions.length; i++) {
    const found = sets
      .filter(set => set.session_id === sessions[i].session_id && set.routine_exercise_id === rexId)
      .sort((a, b) => Number(a.set_number || 0) - Number(b.set_number || 0))
      .map(set => ({
        set_number: Number(set.set_number || 0),
        weight: set.weight === '' ? null : Number(set.weight),
        reps: set.reps === '' ? null : Number(set.reps),
        rir: set.rir === '' ? null : Number(set.rir),
        note: set.note || '',
      }));
    if (found.length > 0) return found;
  }
  return [];
}

function calcSetMetrics_(sets) {
  const clean = (sets || []).filter(s => s.weight !== null || s.reps !== null);
  return clean.reduce((acc, set) => {
    const weight = set.weight === null ? 0 : Number(set.weight);
    const reps = set.reps === null ? 0 : Number(set.reps);
    acc.volume += weight * reps;
    acc.reps_total += reps;
    acc.weight_max = Math.max(acc.weight_max, weight);
    return acc;
  }, { volume: 0, reps_total: 0, weight_max: 0, set_count: clean.length });
}

function compareMetrics_(current, previous, hasPrevious) {
  if (!hasPrevious) return 'Sin datos previos';
  if (current.set_count > 0 && previous.set_count === 0) return 'Mejoró';
  if (current.volume > previous.volume && current.weight_max >= previous.weight_max) return 'Mejoró';
  if (current.volume >= previous.volume * 0.95 && current.weight_max >= previous.weight_max) return 'Igual';
  if (current.volume < previous.volume * 0.95) return 'Bajó';
  return 'Igual';
}

function buildSuggestion_(sets, template) {
  if (!template) return 'Registrar una sesión más para afinar la sugerencia.';
  const min = Number(template.target_reps_min || 0);
  const max = Number(template.target_reps_max || 0);
  const reps = (sets || []).map(s => s.reps).filter(r => r !== null);
  if (reps.length === 0) return 'Completá reps para generar una sugerencia.';
  if (max > 0 && reps.every(r => r >= max)) return 'Subir carga próxima vez.';
  if (min > 0 && max > 0 && reps.every(r => r >= min && r <= max)) return 'Mantener carga, cerrar el rango.';
  if (min > 0 && reps.some(r => r < min)) return 'Repetir o bajar; revisar fatiga/técnica.';
  return 'Mantener y buscar reps limpias.';
}
