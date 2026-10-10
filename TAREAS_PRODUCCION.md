# Tareas pre-producción — Felipe IA (Railway)

Contexto: bot de WhatsApp del Municipio de Valle Viejo (Node.js ≥ 22.5, Baileys + Express + SQLite `node:sqlite`), desplegado en **Railway**. Archivos relevantes:

- `index.js` — conexión a WhatsApp (Baileys), lógica de respuestas, arranque del panel.
- `panel.js` — servidor Express (Basic Auth, `/`, `/qr`, `/api/status`, `/api/stats`).
- `state.js` — estado compartido en memoria (`online`, `connectedAt`, `qrCode`).
- `db.js` — capa SQLite.
- `public/dashboard.html` — panel admin (HTML + JS vanilla, Chart.js por CDN).

Reglas generales:
- Responder y comentar el código en **español** (rioplatense, igual que el resto del proyecto).
- Mantené los comentarios y el estilo existentes; no reescribas archivos enteros ni cambies funcionalidad no relacionada.
- No agregues dependencias nuevas salvo que sea imprescindible (si hace falta alguna, justificarla).
- No toques `auth/`, `data/` ni `faqs.js`.
- No hagas commit ni push: dejá los cambios listos para revisar.

---

## 1. Escapar el texto en el panel (vulnerabilidad XSS) — PRIORIDAD ALTA

**Problema:** en `public/dashboard.html`, las funciones `renderTablaFaqs` y `renderTablaNo` arman HTML con template strings y `innerHTML` insertando datos sin escapar:

- `${f.faq_disparada}` (en `renderTablaFaqs`)
- `${it.pregunta}` dentro de `title="..."` y `${pregunta}` como contenido (en `renderTablaNo`)

Cualquier persona puede mandarle al bot un mensaje como `"><img src=x onerror=alert(1)>`. Ese texto se guarda en SQLite y se ejecuta en el navegador de quien abra el panel (ya autenticado como admin).

**A hacer:**
1. Agregar en el `<script>` de `dashboard.html` una función `escapeHtml(str)` que reemplace `& < > " '` por sus entidades (convertir antes a `String`, tolerando `null`/`undefined`).
2. Usarla en **todos** los lugares donde se inserten datos provenientes de la API dentro de `innerHTML`: `faq_disparada`, `pregunta` (tanto en el atributo `title` como en el texto visible). Aplicar el escape **después** de truncar la pregunta a 55 caracteres, no antes.
3. Revisar que no quede ningún otro `innerHTML` con datos dinámicos (los números ya pasan por `fmt()`, pero verificar igual).
4. Defensa adicional en `panel.js`: agregar un middleware que setee cabeceras de seguridad básicas, por ejemplo:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Content-Security-Policy` compatible con lo que usa el dashboard (scripts inline propios, `cdn.jsdelivr.net` para Chart.js, `fonts.googleapis.com` / `fonts.gstatic.com` para fuentes). Probar que el dashboard siga funcionando con la CSP elegida.

**Criterio de aceptación:** si en la tabla `mensajes` se inserta una pregunta con `<img src=x onerror=alert(1)>`, el panel la muestra como texto literal y no ejecuta nada.

---

## 2. Definir `ADMIN_USER` y `ADMIN_PASS` en Railway

**Problema:** en `panel.js` las credenciales tienen valores por defecto públicos en el repo:

```js
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "felipeia2025";
```

**A hacer (código):**
1. Quitar los valores por defecto. Si `ADMIN_USER` o `ADMIN_PASS` no están definidas:
   - en producción (`process.env.RAILWAY_ENVIRONMENT` o `NODE_ENV === "production"`) **no arrancar el panel** y loguear un error claro en español (`logger.error`) explicando que hay que definir esas variables en Railway;
   - en desarrollo local, permitir arrancar con un aviso (`logger.warn`) usando credenciales de desarrollo, pero que no sean las actuales.
   - Importante: que la falta de credenciales **no tumbe el bot de WhatsApp**, solo el panel. Revisar `iniciarPanel(logger)` y cómo se llama desde `index.js`.
2. Comparar usuario y contraseña con `crypto.timingSafeEqual` (comparar hashes SHA-256 de ambos lados para evitar problemas de longitud distinta).
3. Limitar intentos fallidos de autenticación: por IP (usar `req.ip`; configurar `app.set("trust proxy", 1)` porque Railway está detrás de un proxy), por ejemplo máx. 10 intentos fallidos cada 15 minutos, devolviendo `429` luego. Implementarlo en memoria con un `Map`, sin dependencias.
4. No loguear nunca las credenciales ni el header `Authorization`.

**A hacer (documentación):** actualizar `README.md` con una sección "Variables de entorno en Railway" que liste `ADMIN_USER`, `ADMIN_PASS`, `PHONE_NUMBER` (opcional), `AUTH_FOLDER`, `DB_PATH` y las nuevas del punto 3, con una breve explicación de cada una. El README actual está desactualizado (habla de "demo para mañana"): limpiar lo evidentemente obsoleto en esa sección, sin reescribirlo entero.

**Nota para el usuario (no es código):** hay que cargar `ADMIN_USER` y `ADMIN_PASS` (clave larga y única) en Railway → Variables, y cambiar la clave si alguna vez se usó la de por defecto.

---

## 3. Alertas de desconexión

**Problema:** si WhatsApp se desconecta (sobre todo con `DisconnectReason.loggedOut`), el bot queda muerto y nadie se entera salvo que abra el panel. Además, el panel no tiene forma de ir a `/qr` para volver a vincular.

**A hacer:**

1. **Aviso externo por Telegram** (opcional por variables de entorno, sin dependencias nuevas: usar `fetch` nativo de Node 22):
   - Variables: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`. Si no están definidas, no se envía nada (solo logs).
   - Crear una función `notificarAlerta(mensaje)` (por ejemplo en un archivo nuevo `alertas.js`) que haga `POST https://api.telegram.org/bot<TOKEN>/sendMessage`, con manejo de errores que **nunca** tumbe el bot (try/catch + log).
   - Enviar alerta cuando:
     - la sesión se cierra definitivamente (`loggedOut`) → mensaje urgente: "🔒 Sesión de WhatsApp cerrada, hay que volver a escanear el QR en <URL del panel>/qr";
     - el bot estuvo desconectado más de N minutos (p. ej. 5) sin lograr reconectar;
     - cuando vuelva a conectarse tras haber estado caído → "✅ Felipe IA volvió a estar en línea".
   - Evitar spam: no mandar más de una alerta del mismo tipo cada 10 minutos.
2. **Reconexión con espera creciente** en `index.js`: hoy `iniciarBot()` se vuelve a llamar de inmediato en cada `close`, pudiendo entrar en un bucle. Agregar backoff (por ejemplo 2 s, 5 s, 10 s, 30 s, tope 60 s), resetear el contador al conectar (`connection === "open"`), y evitar que se creen sockets duplicados (cerrar/limpiar el anterior antes de crear el nuevo).
3. **Estado en `state.js`:** agregar campos útiles como `ultimaDesconexion` (timestamp), `motivoDesconexion` (código) y `sesionCerrada` (boolean), y exponerlos en `/api/status`.
4. **Panel (`dashboard.html`):**
   - Cuando el bot esté desconectado, mostrar un botón o enlace bien visible "Vincular WhatsApp" que lleve a `/qr`.
   - Mostrar desde cuándo está desconectado (usando `ultimaDesconexion`).
   - Si `sesionCerrada` es `true`, mostrar un aviso destacado explicando que hay que escanear de nuevo el QR.
   - Mantener el estilo Material Design existente.
5. Documentar en el README cómo crear el bot de Telegram (BotFather) y obtener el `chat_id`.

**Criterio de aceptación:** al forzar un `loggedOut` (o simularlo), llega el aviso por Telegram con el enlace al QR, el panel muestra el botón "Vincular WhatsApp", y al reconectar llega el aviso de recuperación.

---

## 4. Ruta `/health`

**Problema:** todas las rutas de `panel.js` están detrás de Basic Auth (`app.use(basicAuth)`), así que Railway (o un monitor externo) no puede comprobar si el servicio está vivo.

**A hacer:**
1. En `panel.js`, registrar **antes** de `app.use(basicAuth)` una ruta pública `GET /health`.
2. Respuesta JSON mínima y **sin datos sensibles**, por ejemplo:
   ```json
   { "status": "ok", "whatsapp": "online|offline", "uptime": 12345 }
   ```
   - Devolver HTTP `200` mientras el proceso esté vivo (aunque WhatsApp esté desconectado, para que Railway no reinicie en bucle por un problema que un reinicio no arregla; el estado de WhatsApp va en el cuerpo del JSON).
   - Opcional: agregar `GET /health/whatsapp` que devuelva `200` si está en línea y `503` si no, para usarlo con un monitor externo (UptimeRobot, etc.) que sí quiera alertar por desconexión.
3. No exponer números de teléfono, mensajes ni conteos en `/health`.
4. Documentar en el README cómo configurar en Railway: Settings → Deploy → **Healthcheck Path** = `/health`, y recomendar política de reinicio `On Failure`.

**Criterio de aceptación:** `curl https://<dominio-railway>/health` responde `200` sin pedir credenciales; el resto de las rutas siguen protegidas.

---

## Orden sugerido
1. Punto 1 (XSS) — es el más riesgoso.
2. Punto 2 (credenciales).
3. Punto 4 (`/health`) — es chico.
4. Punto 3 (alertas) — el más grande.

## Fuera de alcance (solo recordatorio para el usuario)
Estos puntos también son importantes pero **no** son parte de esta tarea; se configuran en Railway:
- Volumen persistente con `DB_PATH=/app/data/bot.db` y `AUTH_FOLDER=/app/data/auth`.
- Variable `TZ=America/Argentina/Catamarca` (si no, las estadísticas "Hoy/Semana" se desfasan 3 horas).
