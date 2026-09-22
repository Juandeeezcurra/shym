// ============================================================
// Test del port Apps Script -> Workers/D1
// ============================================================
// Ejercita la logica de negocio portada contra un SQLite real, cubriendo el
// flujo completo de la app: crear rutina, dias, ejercicios, entrenar, guardar
// sesion, editar, y leer todas las vistas de progreso.
//
//   node --test tools/port.test.mjs
// ============================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FakeD1 } from './fake-d1.mjs';
import { buildSchemaSql, SHEETS } from '../src/schema.js';
import { Store } from '../src/db.js';
import { API, WRITE_API, setStore } from '../src/api.js';

// Cada request en produccion es load -> logica -> flush. El helper replica
// exactamente ese ciclo para que los tests ejerciten el mismo camino.
async function call(d1, fn, ...args) {
  const store = new Store(d1);
  setStore(store);
  await store.load();
  try {
    const result = API[fn].apply(null, args);
    if (store.hasWrites()) await store.flush();
    return result;
  } finally {
    setStore(null);
  }
}

function freshDb() {
  const d1 = new FakeD1();
  d1.exec(buildSchemaSql());
  return d1;
}

test('ping responde', async () => {
  const d1 = freshDb();
  const res = await call(d1, 'ping');
  assert.ok(res);
});

test('flujo completo: rutina -> dia -> ejercicio -> sesion', async () => {
  const d1 = freshDb();

  const routine = await call(d1, 'createRoutine', 'Push Pull Legs');
  assert.ok(routine.routine_id);

  // La primera rutina queda activa sola.
  const active = await call(d1, 'getActiveRoutine');
  assert.equal(active.routine_id, routine.routine_id);

  const withDay = await call(d1, 'addDay', { routine_id: routine.routine_id, day_name: 'Push', week_days: '1,4' });
  const day = withDay.days[0];
  assert.equal(day.day_name, 'Push');

  await call(d1, 'addExercise', {
    day_id: day.day_id,
    exercise_name: 'Press banca',
    target_sets: 4,
    target_reps_min: 6,
    target_reps_max: 10,
    suggested_weight: 60,
    muscle_group: 'pecho',
  });

  const full = await call(d1, 'getRoutine', routine.routine_id);
  const ex = full.days[0].exercises[0];
  assert.equal(ex.exercise_name, 'Press banca');
  assert.equal(ex.suggested_weight, 60);

  const saved = await call(d1, 'saveSession', {
    date: '2026-09-15',
    routine_id: routine.routine_id,
    day_id: day.day_id,
    bodyweight: 78.5,
    notes: 'buena',
    exercises: [{
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: 'Press banca',
      muscle_group: 'pecho',
      sets: [
        { set_number: 1, weight: 60, reps: 10, rir: 2 },
        { set_number: 2, weight: 65, reps: 8, rir: 1 },
        { set_number: 3, weight: 65, reps: 7, rir: 0 },
      ],
    }],
  });

  assert.ok(saved.session.session_id);
  assert.equal(saved.summary.exercises[0].metrics.set_count, 3);
  // volumen = 60*10 + 65*8 + 65*7 = 600 + 520 + 455 = 1575
  assert.equal(saved.summary.total_volume, 1575);

  const fetched = await call(d1, 'getSession', { session_id: saved.session.session_id });
  assert.equal(fetched.bodyweight, 78.5);
  assert.equal(fetched.exercises[0].sets.length, 3);
});

test('series vacias se guardan como vacio, no como cero', async () => {
  // Esta es la regresion mas peligrosa del port: en Sheets una celda vacia
  // volvia como '', y la logica hace `weight === '' ? null : Number(weight)`.
  // Si D1 devolviera null, Number(null) daria 0 y una serie sin peso contaria
  // como 0kg, ensuciando volumen, maximos y 1RM.
  const d1 = freshDb();
  const routine = await call(d1, 'createRoutine', 'Test');
  const withDay = await call(d1, 'addDay', { routine_id: routine.routine_id, day_name: 'A' });
  const day = withDay.days[0];
  await call(d1, 'addExercise', { day_id: day.day_id, exercise_name: 'Dominadas', target_sets: 3, target_reps_min: 8, target_reps_max: 12, muscle_group: 'espalda' });
  const full = await call(d1, 'getRoutine', routine.routine_id);
  const ex = full.days[0].exercises[0];

  const saved = await call(d1, 'saveSession', {
    date: '2026-09-16',
    routine_id: routine.routine_id,
    day_id: day.day_id,
    exercises: [{
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: 'Dominadas',
      muscle_group: 'espalda',
      sets: [
        { set_number: 1, weight: '', reps: 12, rir: '' },
        { set_number: 2, weight: '', reps: 10, rir: '' },
      ],
    }],
  });

  const fetched = await call(d1, 'getSession', { session_id: saved.session.session_id });
  const sets = fetched.exercises[0].sets;
  assert.equal(sets[0].weight, null, 'peso vacio debe leerse como null, no 0');
  assert.equal(sets[0].reps, 12);
  assert.equal(sets[0].rir, null);
});

test('is_active vuelve como booleano nativo', async () => {
  // getTrainPickData hace `routines.find(r => r.is_active)` SIN isTrue_.
  // Si is_active fuese el string 'false', seria truthy y elegiria mal.
  const d1 = freshDb();
  const a = await call(d1, 'createRoutine', 'Rutina A');
  const b = await call(d1, 'createRoutine', 'Rutina B');

  await call(d1, 'setActiveRoutine', b.routine_id);

  const list = await call(d1, 'listRoutines');
  const rowA = list.find(r => r.routine_id === a.routine_id);
  const rowB = list.find(r => r.routine_id === b.routine_id);
  assert.equal(rowA.is_active, false);
  assert.equal(rowB.is_active, true);

  const pick = await call(d1, 'getTrainPickData', {});
  assert.equal(pick.routine.routine_id, b.routine_id, 'debe elegir la rutina realmente activa');
});

test('editar y borrar sesion', async () => {
  const d1 = freshDb();
  const routine = await call(d1, 'createRoutine', 'R');
  const withDay = await call(d1, 'addDay', { routine_id: routine.routine_id, day_name: 'D' });
  const day = withDay.days[0];
  await call(d1, 'addExercise', { day_id: day.day_id, exercise_name: 'Sentadilla', target_sets: 3, target_reps_min: 5, target_reps_max: 8, muscle_group: 'piernas' });
  const ex = (await call(d1, 'getRoutine', routine.routine_id)).days[0].exercises[0];

  const saved = await call(d1, 'saveSession', {
    date: '2026-09-17',
    routine_id: routine.routine_id,
    day_id: day.day_id,
    exercises: [{
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: 'Sentadilla',
      muscle_group: 'piernas',
      sets: [{ set_number: 1, weight: 100, reps: 5 }],
    }],
  });

  await call(d1, 'editSession', {
    session_id: saved.session.session_id,
    date: '2026-09-17',
    bodyweight: 80,
    notes: 'editada',
    exercises: [{
      routine_exercise_id: ex.routine_exercise_id,
      exercise_name: 'Sentadilla',
      muscle_group: 'piernas',
      sets: [{ set_number: 1, weight: 110, reps: 5 }],
    }],
  });

  const after = await call(d1, 'getSession', { session_id: saved.session.session_id });
  assert.equal(after.notes, 'editada');
  assert.equal(after.exercises[0].sets[0].weight, 110);

  await call(d1, 'deleteSession', { session_id: saved.session.session_id });
  await assert.rejects(() => call(d1, 'getSession', { session_id: saved.session.session_id }));

  // Los sets de la sesion borrada no deben quedar huerfanos.
  const store = new Store(d1);
  setStore(store);
  await store.load();
  assert.equal(store.readAll(SHEETS.SETS).length, 0);
  setStore(null);
});

test('borrar rutina limpia dias y ejercicios en cascada', async () => {
  const d1 = freshDb();
  const r = await call(d1, 'createRoutine', 'Borrable');
  const withDay = await call(d1, 'addDay', { routine_id: r.routine_id, day_name: 'X' });
  await call(d1, 'addExercise', { day_id: withDay.days[0].day_id, exercise_name: 'Curl', target_sets: 3, target_reps_min: 8, target_reps_max: 12, muscle_group: 'biceps' });

  await call(d1, 'deleteRoutine', r.routine_id);

  const store = new Store(d1);
  setStore(store);
  await store.load();
  assert.equal(store.readAll(SHEETS.DAYS).length, 0);
  assert.equal(store.readAll(SHEETS.EXERCISES).length, 0);
  setStore(null);
});

test('nutricion: guardar, leer y target en settings', async () => {
  const d1 = freshDb();
  await call(d1, 'saveNutritionDay', {
    date: '2026-09-18', kcal: 2100, protein: 160, fat: 70, carbs: 200, weight: 78, water: 3, steps: 9000, trained: true,
  });
  const day = await call(d1, 'getNutritionDay', { date: '2026-09-18' });
  assert.equal(day.kcal, 2100);
  assert.equal(day.trained, true);

  const hist = await call(d1, 'listNutritionHistory', { limit: 10 });
  assert.equal(hist.length, 1);
});

test('el batch de escrituras es atomico: si algo falla no se aplica nada', async () => {
  const d1 = freshDb();
  const store = new Store(d1);
  setStore(store);
  await store.load();
  API.createRoutine('Se aplica');
  // Se encola una sentencia invalida a mano para forzar el fallo del batch.
  store.pending.push(d1.prepare('INSERT INTO tabla_que_no_existe (x) VALUES (1)'));
  await assert.rejects(() => store.flush());
  setStore(null);

  const check = new Store(d1);
  setStore(check);
  await check.load();
  assert.equal(check.readAll(SHEETS.ROUTINES).length, 0, 'la rutina no debe haberse guardado');
  setStore(null);
});

test('todas las lecturas responden con base vacia', async () => {
  // Varias vistas se rompian historicamente con cero datos. Se chequea que
  // ninguna tire excepcion inesperada.
  const d1 = freshDb();
  const readOnly = Object.keys(API).filter(fn => !WRITE_API.has(fn));
  const errors = [];
  for (const fn of readOnly) {
    try {
      await call(d1, fn, {});
    } catch (err) {
      // Errores de validacion esperados: son endpoints que exigen parametros
      // o que avisan a proposito cuando no hay datos todavia.
      if (/requerido|No hay rutina activa|no encontrad/i.test(err.message)) continue;
      errors.push(`${fn}: ${err.message}`);
    }
  }
  assert.deepEqual(errors, [], 'lecturas que fallan con base vacia');
});
