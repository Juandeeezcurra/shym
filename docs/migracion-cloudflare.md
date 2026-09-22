# Migración a Cloudflare — runbook

Pasos para pasar Shym de **GitHub Pages + Apps Script + Google Sheets** a
**Cloudflare Workers + D1**. El código ya está listo en el repo; lo que sigue
son los pasos que hay que correr una sola vez.

Antes de empezar: **no borres nada de Google**. El Sheet y el deploy de Apps
Script siguen funcionando hasta que confirmes que Cloudflare anda bien. La
vuelta atrás es cambiar la URL, nada más.

---

## 0. Requisitos

```bash
npm install
npx wrangler login     # abre el navegador para autorizar tu cuenta
```

## 1. Crear la base D1

```bash
npx wrangler d1 create shym
```

Devuelve un `database_id`. **Copialo a `wrangler.toml`**, reemplazando
`PENDIENTE_CORRER_wrangler_d1_create_shym`.

Después creá las tablas:

```bash
npx wrangler d1 migrations apply shym --remote
```

## 2. Definir el token de acceso

```bash
# Generá uno al azar y guardalo en tu gestor de contraseñas:
openssl rand -base64 32

npx wrangler secret put SHYM_TOKEN
```

Sin este secreto la API responde `503` a todo. Es a propósito: un deploy sin
token queda cerrado, no abierto.

## 3. Exportar los datos del Sheet

Este es el último redeploy de Apps Script.

1. Copiá `Code.gs` del repo (ya incluye `exportAll` y su registro en `getApi_`).
2. Pegalo en Apps Script reemplazando todo.
3. Deploy → Manage deployments → Edit → Version: New version → Deploy.
4. Exportá:

```bash
curl -s -X POST "https://script.google.com/macros/s/TU_ID/exec" \
  -H 'Content-Type: text/plain;charset=utf-8' \
  -d '{"fn":"exportAll","args":[]}' > shym-export.json
```

Verificá que trajo todo antes de seguir:

```bash
node tools/import-sheets.mjs --dry-run
```

Imprime cuántas filas tiene cada tabla. Si alguna da 0 y no debería, pará acá.

## 4. Importar a D1

Primero local, para probar sin tocar producción:

```bash
npx wrangler d1 migrations apply shym --local
node tools/import-sheets.mjs --local
npm run dev
```

Abrí `http://localhost:8788`, pegá el token de `.dev.vars` y revisá que estén
tus rutinas, tu historial y el informe de rendimiento.

Cuando estés conforme:

```bash
node tools/import-sheets.mjs --remote
```

El import borra las tablas antes de escribir, así que se puede repetir las
veces que haga falta.

## 5. Deploy

```bash
npx wrangler deploy
```

Te da una URL `https://shym.<tu-subdominio>.workers.dev`. Abrila, pegá el
token y listo.

## 6. Después de confirmar que anda

- Sacá Shym de GitHub Pages (Settings → Pages → None) para que no queden dos
  versiones vivas apuntando a backends distintos.
- Volvé a agregar la app a la pantalla de inicio del iPhone: es otro dominio,
  así que iOS la trata como una app nueva.
- El Sheet de Google quedátelo un tiempo como respaldo. Ya no se actualiza.

---

## Qué cambió

| | Antes | Ahora |
|---|---|---|
| Frontend | GitHub Pages | Worker (`public/`) |
| Backend | Apps Script `/exec` | Worker `/api` |
| Datos | Google Sheets | D1 (SQLite) |
| Origen | dos dominios, con CORS | uno solo |
| Acceso | URL no publicada | token en header |
| Deploy | copiar y pegar a mano | `npx wrangler deploy` |
| Latencia típica | 1–3 s | decenas de ms |

## Estructura

```
src/schema.js    modelo de datos: genera el SQL y el mapeo de tipos
src/db.js        capa de datos D1, con las firmas síncronas de Sheets
src/platform.js  uuid, fechas y zona horaria
src/api.js       GENERADO — lógica de negocio portada de Code.gs
src/index.js     routing, auth y ciclo load → lógica → flush
migrations/      DDL de D1
public/          el frontend
tools/           port, import/export y tests
```

`src/api.js` no se edita a mano. Se edita `Code.gs` y se regenera:

```bash
npm run port && npm test
```

## Cómo funciona el port

La lógica de negocio de Apps Script es síncrona de punta a punta y D1 es
asíncrono. En vez de convertir ~200 funciones a `async`, cada request hace:

1. **load** — una lectura trae las tablas a memoria.
2. **lógica** — corre síncrona, sin cambios: lee de memoria, y las escrituras
   mutan memoria y se encolan.
3. **flush** — la cola se manda en un único `d1.batch()`, que D1 corre como
   transacción.

Por eso las ~4.700 líneas portadas quedaron intactas, y por eso ya no hace
falta `LockService`: el batch da atomicidad, algo que con Sheets no existía.

## Detalles que importan

- **Celdas vacías.** Sheets devolvía `''`, no `null`. La lógica hace
  `weight === '' ? null : Number(weight)` en más de veinte lugares; con `null`,
  `Number(null)` da `0` y una serie sin peso contaría como 0 kg. `db.js`
  convierte `NULL → ''` para replicar Sheets exactamente.
- **Zona horaria.** Los Workers corren en UTC. Sin la var `TZ` de
  `wrangler.toml`, un entrenamiento cargado 22 h en Buenos Aires se guardaría
  con la fecha del día siguiente y correría la racha y el calendario.
- **`is_active`.** `getTrainPickData` hace `routines.find(r => r.is_active)`
  sin pasar por `isTrue_`, así que tiene que volver como booleano nativo: el
  string `'false'` sería truthy y elegiría la rutina equivocada.
- **Cache de servidor.** Se eliminó. Existía porque Apps Script tardaba 1–3 s
  por llamada; con D1 sólo agregaba datos viejos. El cache de `localStorage`
  del frontend se mantiene.

## Pendiente

- **Precarga selectiva.** Hoy cada request trae las 8 tablas enteras. Con unos
  miles de filas es irrelevante, pero si el historial crece mucho conviene
  declarar qué tablas necesita cada endpoint.
- **Concurrencia.** Dos requests simultáneos podrían pisarse (leer → calcular →
  escribir). Con un solo usuario es despreciable; si alguna vez hay más de uno,
  la solución es un Durable Object.
