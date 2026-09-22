// ============================================================
// SHYM — WORKER ENTRY
// ============================================================
// Reemplaza a doGet/doPost de Apps Script. Mantiene el MISMO contrato de API
// que ya usa el frontend, asi que index.html casi no cambia:
//
//   POST { fn: 'nombreFuncion', args: [...] }
//   ->   { ok: true, result: ... }  |  { ok: false, error: '...' }
//
// Ciclo de cada request: load -> logica sincrona -> flush transaccional.
// ============================================================

import { API, WRITE_API, setStore } from './api.js';
import { Store } from './db.js';
import { setTimezone } from './platform.js';

const MAX_BATCH = 12;

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

// El frontend y la API comparten origen, asi que CORS no haria falta. Se deja
// abierto igual para que la app vieja de GitHub Pages pueda seguir apuntando
// aca durante la transicion, y para poder probar desde otro origen.
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Shymie-Token',
    'Access-Control-Max-Age': '86400',
  };
}

// Comparacion de tiempo constante: evita que se pueda adivinar el token
// midiendo cuanto tarda la respuesta.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request, env) {
  const expected = env.SHYMIE_TOKEN;
  // Sin token configurado la API queda cerrada, no abierta. Un deploy al que
  // se le olvido el secreto debe fallar ruidosamente y no quedar publico.
  if (!expected) {
    return { ok: false, status: 503, error: 'Backend sin SHYMIE_TOKEN configurado.' };
  }
  const provided = request.headers.get('X-Shymie-Token') || '';
  if (!safeEqual(provided, expected)) {
    return { ok: false, status: 401, error: 'Token invalido.' };
  }
  return { ok: true };
}

function runCall(fn, args) {
  const name = (fn || '').toString();
  if (!Object.prototype.hasOwnProperty.call(API, name)) {
    throw new Error('Funcion API no permitida: ' + name);
  }
  return API[name].apply(null, Array.isArray(args) ? args : []);
}

async function handleApi(request, env) {
  const auth = authorize(request, env);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Body invalido: se esperaba JSON.' }, 400);
  }

  const fn = (body && body.fn || '').toString();
  const args = Array.isArray(body && body.args) ? body.args : [];

  if (!env.DB) return json({ ok: false, error: 'Falta el binding DB de D1.' }, 503);

  const store = new Store(env.DB);
  setStore(store);

  try {
    await store.load();

    let result;
    let isWrite;

    if (fn === 'batch') {
      const calls = Array.isArray(args[0]) ? args[0] : [];
      if (calls.length > MAX_BATCH) throw new Error(`batch: maximo ${MAX_BATCH} llamadas.`);
      isWrite = calls.some(c => WRITE_API.has((c && c.fn || '').toString()));
      result = calls.map(call => {
        try {
          return { ok: true, result: runCall(call && call.fn, call && call.args) };
        } catch (err) {
          return { ok: false, error: err && err.message ? err.message : String(err) };
        }
      });
    } else {
      result = runCall(fn, args);
      isWrite = WRITE_API.has(fn);
    }

    // Un unico batch transaccional con todo lo que la logica encolo.
    if (store.hasWrites()) await store.flush();

    return json({ ok: true, result });
  } catch (err) {
    // Si algo falla antes del flush, las escrituras encoladas se descartan
    // con el Store: nunca se aplica una mutacion a medias.
    return json({ ok: false, error: err && err.message ? err.message : String(err) });
  } finally {
    setStore(null);
  }
}

export default {
  async fetch(request, env, ctx) {
    setTimezone(env.TZ);

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/api') {
      if (request.method === 'POST') return handleApi(request, env);
      // Equivalente al doGet() viejo: healthcheck legible.
      return json({
        ok: true,
        app: 'Shymie API',
        message: 'Backend activo en Cloudflare Workers.',
        time: new Date().toISOString(),
      });
    }

    // Todo lo demas lo sirve el binding de static assets (public/).
    return env.ASSETS.fetch(request);
  },
};
