# Shym / Shymie

Este repo tiene **dos apps de gym tracking**, no una. Son la misma idea y casi
el mismo código, pero corren en infraestructuras distintas y **no comparten
datos**.

| | **Shym** (vieja) | **Shymie** (nueva) |
|---|---|---|
| URL | https://juandeeezcurra.github.io/shym/ | https://shymie.shymie.workers.dev |
| Frontend | GitHub Pages, desde la raíz | Worker, desde `public/` |
| Backend | Apps Script `/exec` | Worker `/api` |
| Datos | Google Sheets | D1 (SQLite) |
| Acceso | URL no publicada | token en header `X-Shymie-Token` |
| Deploy | copiar y pegar a mano | `npx wrangler deploy` |
| Latencia | 1–3 s | decenas de ms |

**No están conectadas.** Shymie arrancó con una copia única del Sheet
(2026-09-21). Desde ese momento las dos bases divergen: lo que cargues en una
no aparece en la otra, y no hay forma de fusionarlas. **Usá una sola.**

Shymie es la que vale. Shym queda prendida como backup hasta que Shymie tenga
unas semanas de uso real encima.

---

## Qué archivo es de qué

### Shymie (la nueva)

```
public/           frontend
src/              backend del Worker
  schema.js         modelo de datos: genera el SQL y el mapeo de tipos
  db.js             capa D1, con las firmas síncronas que tenía Sheets
  platform.js       uuid, fechas, zona horaria
  api.js            GENERADO — no editar a mano (ver abajo)
  index.js          routing, auth y ciclo load -> lógica -> flush
migrations/       DDL de D1
tools/            port, import/export y tests
wrangler.toml     config del Worker
package.json
docs/migracion-cloudflare.md    runbook de puesta en marcha
```

### Shym (la vieja)

```
index.html              la app entera, en un solo archivo
manifest.webmanifest
assets/                 imágenes (duplicadas en public/assets/, a propósito:
                        cada app sirve las suyas)
```

### Compartido — el único punto de contacto

```
Code.gs           lógica de negocio
```

`Code.gs` **no es de Shym**, aunque viva en la raíz y parezca suyo:

- Shym lo corre tal cual en Apps Script.
- Shymie genera `src/api.js` a partir de él con `npm run port`.

Es la fuente de verdad de las dos. **Nunca lo borres**, ni siquiera cuando
retires Shym: sin él no podés volver a generar la lógica de Shymie.

### Ni de una ni de otra

`MEMORY.md`, `PLAN_REDISENO.md`, `pending.md` (viejo, de abril 2026),
`PLAN_ENTRENAMIENTO_LIBRE.md`, `spec-modulo-nutricion.md`,
`heatmap-preview.html`, `logo png.png`, `new logo.png`.

---

## Cómo tocar la lógica

La lógica de negocio se edita **siempre en `Code.gs`**, nunca en `src/api.js`.

Mientras las dos apps convivan, un cambio hay que aplicarlo **en los dos
lados** o una queda vieja:

```bash
npm run port && npm test     # -> regenera src/api.js para Shymie
npx wrangler deploy          # -> sube Shymie
```

Y además, para Shym: pegar `Code.gs` en Apps Script y hacer
Deploy → Manage deployments → Edit → Version: New version → Deploy.

Ese doble mantenimiento se termina el día que retires Shym.

### Por qué el port funciona así

Apps Script es síncrono de punta a punta y D1 es asíncrono. En vez de convertir
~200 funciones a `async`, cada request hace:

1. **load** — una lectura trae las tablas a memoria.
2. **lógica** — corre síncrona, sin cambios: lee de memoria, y las escrituras
   mutan memoria y se encolan.
3. **flush** — la cola se manda en un único `d1.batch()`, que D1 corre como
   transacción.

Por eso las ~4.700 líneas portadas quedaron intactas, y por eso ya no hace
falta `LockService`: el batch da atomicidad, algo que con Sheets no existía.

---

## Retirar Shym (cuando Shymie tenga rodaje)

En orden, del más reversible al menos:

1. Borrar `index.html`, `manifest.webmanifest` y `assets/`, y apagar GitHub Pages.
2. Borrar el deploy de Apps Script.
3. Borrar el Google Sheet — **último**: es la única otra copia de tu historial.

`Code.gs` se queda. No es opcional.

---

## Arrancar Shymie de cero

Ver [`docs/migracion-cloudflare.md`](docs/migracion-cloudflare.md). Resumen:

```bash
npm install
npx wrangler login
npx wrangler d1 create shymie        # -> database_id a wrangler.toml
npm run db:migrate                   # crea las tablas
npx wrangler secret put SHYMIE_TOKEN # sin esto la API responde 503 a todo
npx wrangler deploy
```

Para desarrollo local hace falta un `.dev.vars` con `SHYMIE_TOKEN=...`
(ignorado por git). `npm run dev` levanta en `http://localhost:8787`.
