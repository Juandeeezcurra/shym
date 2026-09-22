# Shymie — runbook de puesta en marcha

Este repo ahora tiene **dos apps independientes**, que no comparten backend
ni datos:

- **Shym** (la vieja): GitHub Pages + Apps Script + Google Sheets, en la raíz
  del repo (`index.html`, `manifest.webmanifest`, `assets/`). Sigue
  funcionando exactamente igual que siempre. No se toca.
- **Shymie** (la nueva): Cloudflare Workers + D1, en `public/` + `src/`. Es un
  puerto de la misma lógica de negocio, pero con su propia base de datos
  vacía hasta que se importe.

Son dos productos separados a propósito: distinto dominio, distinto storage
del navegador, distinto token. Podés tener las dos instaladas en el celular a
la vez sin que se pisen. Este documento es la puesta en marcha de Shymie.

---

## 0. Requisitos

```bash
npm install
npx wrangler login     # abre el navegador para autorizar tu cuenta
```

## 1. Crear la base D1

```bash
npx wrangler d1 create shymie
```

Devuelve un `database_id`. **Copialo a `wrangler.toml`**, reemplazando
`PENDIENTE_CORRER_wrangler_d1_create_shymie`.

Después creá las tablas:

```bash
npx wrangler d1 migrations apply shymie --remote
```

## 2. Definir el token de acceso

```bash
# Generá uno al azar y guardalo en tu gestor de contraseñas:
openssl rand -base64 32

npx wrangler secret put SHYMIE_TOKEN
```

Sin este secreto la API responde `503` a todo. Es a propósito: un deploy sin
token queda cerrado, no abierto.

## 3. Traer los datos de Shym (opcional)

Si querés arrancar Shymie con tu historial real en vez de en blanco, este paso
saca los datos del Sheet una vez. **No modifica ni interrumpe Shym**: es de
sólo lectura sobre Apps Script.

1. Copiá `Code.gs` del repo (ya incluye `exportAll` y su registro en `getApi_`).
2. Pegalo en Apps Script reemplazando todo.
3. Deploy → Manage deployments → Edit → Version: New version → Deploy.
4. Exportá:

```bash
node -e "fetch('https://script.google.com/macros/s/TU_ID/exec',{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({fn:'exportAll',args:[]})}).then(r=>r.text()).then(t=>require('fs').writeFileSync('shymie-export.json',t))"
```

Con `curl` no funciona: Apps Script responde 302 hacia `googleusercontent.com`
y el redirect se reenvia sin `Content-Length`, asi que Google devuelve
**411 Length Required** y el archivo queda con un HTML de error adentro.
El `fetch` de Node sigue el redirect correctamente.

`shymie-export.json` tiene todo tu historial y esta en `.gitignore`: no lo
subas al repo.

Verificá que trajo todo antes de seguir:

```bash
node tools/import-sheets.mjs --dry-run
```

Imprime cuántas filas tiene cada tabla. Si alguna da 0 y no debería, pará acá.

## 4. Importar a D1

Primero local, para probar sin tocar producción:

```bash
npx wrangler d1 migrations apply shymie --local
node tools/import-sheets.mjs --local
npm run dev
```

Abri `http://localhost:8787` (el puerto por defecto de `wrangler dev`), pega
el token de `.dev.vars` y revisa que esten tus rutinas, tu historial y el
informe de rendimiento.

Para probarlo desde el celular sin deployar, ata el server a toda la red:

```bash
npx wrangler dev --ip 0.0.0.0
```

Wrangler imprime la IP de LAN (tipo `http://192.168.0.99:8787`). Funciona solo
con la compu prendida y el celular en la misma red: es para probar, no para
usar en serio.

Cuando estés conforme:

```bash
node tools/import-sheets.mjs --remote
```

El import borra las tablas antes de escribir, así que se puede repetir las
veces que haga falta.

## 5. Registrar el subdominio workers.dev

La primera vez, la cuenta no tiene subdominio y `wrangler deploy` sube el
Worker pero falla al publicarlo, con:

```
You need to register a workers.dev subdomain before publishing to workers.dev
```

Es un paso unico de cuenta y hay que hacerlo en el navegador (no hay comando de
wrangler para esto, y el prompt interactivo no corre en modo no-interactivo):

1. Entra a https://dash.cloudflare.com → Workers & Pages
2. Elegi el subdominio. Es global y queda fijo: todos tus Workers viven en
   `<worker>.<subdominio>.workers.dev`.

## 6. Deploy

```bash
npx wrangler deploy
```

Te da una URL `https://shymie.<tu-subdominio>.workers.dev`. Abrila, pega el
token y listo.

Agregala a la pantalla de inicio del celular como una app nueva (es otro
dominio, asi que iOS/Android no la confunde con Shym).

## Si algo sale mal

Shym sigue intacta en GitHub Pages, con su propio Sheet y su propio deploy de
Apps Script. No depende de nada de lo de arriba. Podés seguir usándola sin
límite mientras probás Shymie en paralelo.

---

## Qué es cada cosa

| | Shym (vieja) | Shymie (nueva) |
|---|---|---|
| Frontend | GitHub Pages, raíz del repo | Worker, `public/` |
| Backend | Apps Script `/exec` | Worker `/api` |
| Datos | Google Sheets | D1 (SQLite) |
| Origen | dos dominios, con CORS | uno solo |
| Acceso | URL no publicada | token en header `X-Shymie-Token` |
| Deploy | copiar y pegar a mano | `npx wrangler deploy` |
| Latencia típica | 1–3 s | decenas de ms |

## Estructura de Shymie

```
src/schema.js    modelo de datos: genera el SQL y el mapeo de tipos
src/db.js        capa de datos D1, con las firmas síncronas de Sheets
src/platform.js  uuid, fechas y zona horaria
src/api.js       GENERADO — lógica de negocio portada de Code.gs
src/index.js     routing, auth y ciclo load → lógica → flush
migrations/      DDL de D1
public/          el frontend de Shymie
tools/           port, import/export y tests
```

`src/api.js` no se edita a mano. Se edita `Code.gs` (la misma fuente que usa
Shym) y se regenera:

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
- **Mantener Shym y Shymie en sync.** Mientras las dos convivan, un fix de
  lógica hecho en `Code.gs` hay que pegarlo también en el Sheet de Apps Script
  para que Shym lo tenga, y correr `npm run port` para que Shymie lo tenga.
  Si algún día se retira Shym, ese doble mantenimiento desaparece.
