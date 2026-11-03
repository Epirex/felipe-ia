// ============================================================
// SERVIDOR WEB — PANEL ADMINISTRATIVO
// Express sirve el dashboard y expone rutas /api/*
// Protegido con login (usuario y contraseña) y sesión por cookie
// ============================================================

const express = require("express");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");
const {
  getResumenTotal,
  getTopFaqs,
  getNoRespondidos,
  descartarNoRespondida,
  descartarTodasNoRespondidas,
  getUltimosMensajes,
  getMensajesParaCsv,
  getDistribucionTipos,
  getMensajesPorPeriodo,
} = require("./db");
const { crearRouterReclamos } = require("./reclamosPanel");
const botState = require("./state");

// ── Configuración ─────────────────────────────────────────────
// Definí ADMIN_USER y ADMIN_PASS en las variables de entorno de Railway.
let ADMIN_USER = process.env.ADMIN_USER;
let ADMIN_PASS = process.env.ADMIN_PASS;
const PORT       = process.env.PORT || 3000;

const app = express();

// ── Seguridad (Prevención XSS y Clickjacking) ─────────────────
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src fonts.gstatic.com; img-src 'self' data:;"
  );
  next();
});

app.set("trust proxy", 1); // Necesario para obtener IP real detrás de Railway

// ── Salud del servicio (Healthcheck para Railway) ─────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    whatsapp: botState.online ? "online" : "offline",
    uptime: botState.connectedAt ? Math.floor((Date.now() - botState.connectedAt) / 1000) : null
  });
});

app.get("/health/whatsapp", (req, res) => {
  if (botState.online) return res.status(200).send("OK");
  res.status(503).send("Service Unavailable");
});

// ── Rate Limiting en memoria para Auth ────────────────────────
const fallosAuth = new Map(); // IP -> { intentos, timestamp }
const MAX_FALLOS = 10;
const TIEMPO_BLOQUEO = 15 * 60 * 1000; // 15 minutos

// ── Autenticación por sesión (login propio con cookie) ────────
const SESION_COOKIE = "fsid";
const SESION_DURACION = 8 * 60 * 60 * 1000; // 8 horas
const sesiones = new Map(); // token -> expira (ms)

function leerCookieSesion(req) {
  const h = req.headers.cookie || "";
  for (const parte of h.split(";")) {
    const i = parte.indexOf("=");
    if (i > -1 && parte.slice(0, i).trim() === SESION_COOKIE) return parte.slice(i + 1).trim();
  }
  return null;
}

function sesionValida(req) {
  const token = leerCookieSesion(req);
  if (!token) return false;
  const expira = sesiones.get(token);
  if (!expira) return false;
  if (Date.now() > expira) { sesiones.delete(token); return false; }
  return true;
}

setInterval(() => {
  const ahora = Date.now();
  for (const [t, exp] of sesiones) if (ahora > exp) sesiones.delete(t);
}, 10 * 60 * 1000).unref();

function comparar(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function paginaLogin(error) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Felipe - Iniciar sesión</title>
<style>
  *{box-sizing:border-box}
  body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#e0f2fe,#f0f4f8);min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12);padding:36px 32px;width:100%;max-width:380px}
  h1{margin:0 0 4px;color:#1a56db;font-size:1.6rem;text-align:center}
  .sub{color:#64748b;text-align:center;font-size:.9rem;margin-bottom:24px}
  label{display:block;font-size:.85rem;color:#334155;margin:14px 0 6px;font-weight:600}
  input{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:1rem}
  input:focus{outline:none;border-color:#1a56db;box-shadow:0 0 0 3px rgba(26,86,219,.15)}
  button{width:100%;margin-top:22px;padding:12px;background:#1a56db;color:#fff;border:0;border-radius:8px;font-size:1rem;font-weight:600;cursor:pointer}
  button:hover{background:#1648b8}
  .error{background:#fee2e2;color:#b91c1c;padding:10px 12px;border-radius:8px;font-size:.88rem;margin-bottom:6px}
</style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <h1>Felipe</h1>
    <div class="sub">Panel Administrativo - Municipalidad de Valle Viejo</div>
    ${error ? `<div class="error">${error}</div>` : ""}
    <label for="usuario">Usuario</label>
    <input id="usuario" name="usuario" type="text" autocomplete="username" required autofocus>
    <label for="clave">Contraseña</label>
    <input id="clave" name="clave" type="password" autocomplete="current-password" required>
    <button type="submit">Iniciar sesión</button>
  </form>
</body>
</html>`;
}

// ── Rutas de login / logout ───────────────────────────────────
app.get("/login", (req, res) => {
  if (sesionValida(req)) return res.redirect("/");
  res.send(paginaLogin(""));
});

app.post("/login", express.urlencoded({ extended: false, limit: "10kb" }), (req, res) => {
  const ip = req.ip;
  const ahora = Date.now();
  const estadoIP = fallosAuth.get(ip) || { intentos: 0, timestamp: ahora };

  if (ahora - estadoIP.timestamp > TIEMPO_BLOQUEO) {
    estadoIP.intentos = 0;
    estadoIP.timestamp = ahora;
  }
  if (estadoIP.intentos >= MAX_FALLOS) {
    fallosAuth.set(ip, estadoIP);
    return res.status(429).send(paginaLogin("Demasiados intentos fallidos. Intente más tarde."));
  }

  const user = req.body?.usuario ?? "";
  const pass = req.body?.clave ?? "";
  const userOk = comparar(user, ADMIN_USER);
  const passOk = comparar(pass, ADMIN_PASS);

  if (!(userOk && passOk)) {
    estadoIP.intentos++;
    estadoIP.timestamp = ahora;
    fallosAuth.set(ip, estadoIP);
    return res.status(401).send(paginaLogin("Usuario o contraseña incorrectos"));
  }

  fallosAuth.delete(ip);
  const token = crypto.randomBytes(32).toString("hex");
  sesiones.set(token, ahora + SESION_DURACION);
  const seguro = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `${SESION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESION_DURACION / 1000}${seguro ? "; Secure" : ""}`
  );
  res.redirect("/");
});

app.post("/logout", (req, res) => {
  const token = leerCookieSesion(req);
  if (token) sesiones.delete(token);
  res.setHeader("Set-Cookie", `${SESION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.redirect("/login");
});

function requerirSesion(req, res, next) {
  if (sesionValida(req)) return next();
  if (req.path.startsWith("/api/")) return res.status(401).json({ error: "No autenticado" });
  return res.redirect("/login");
}

// ── Archivos estáticos (audio, imágenes, etc.) públicos ───────
app.use("/audio", express.static(path.join(__dirname, "public", "audio")));

// ── Reclamos: login propio por usuario/dirección (NO usa la sesión del admin) ──
// Va antes de requerirSesion a propósito; internamente exige sesión y filtra por categoría.
app.use(crearRouterReclamos(() => ({ user: ADMIN_USER, pass: ADMIN_PASS })));

app.use(requerirSesion);
app.use(express.json());

// ── Dashboard HTML ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ── Página del QR para escanear ───────────────────────────────
app.get("/qr", (req, res) => {
  if (botState.online) {
    return res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Felipe — QR</title>
      <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f0f4f8;margin:0;text-align:center}</style>
      </head><body>
      <h2 style="color:#10b981">✅ Bot ya conectado</h2>
      <p>No necesitás escanear ningún QR.</p>
      <a href="/" style="color:#1a56db">← Volver al panel</a>
      </body></html>`);
  }
  if (!botState.qrCode) {
    return res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Felipe — QR</title>
      <meta http-equiv="refresh" content="3">
      <style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;background:#f0f4f8;margin:0;text-align:center}</style>
      </head><body>
      <h2>⏳ Esperando QR...</h2>
      <p>La página se actualiza sola. Si tarda más de 30 segundos, reiniciá el servicio.</p>
      </body></html>`);
  }
  res.send(`<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Felipe — Escanear QR</title>
    <meta http-equiv="refresh" content="30">
    <style>
      body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column;
             align-items: center; justify-content: center; min-height: 100vh;
             background: #f0f4f8; margin: 0; text-align: center; padding: 20px; }
      h1  { color: #1a56db; margin-bottom: 8px; font-size: 1.4rem; }
      p   { color: #64748b; margin: 0 0 24px; font-size: 0.95rem; }
      img { border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.15); max-width: 300px; }
      .steps { background: #fff; border-radius: 12px; padding: 20px 24px; margin-top: 24px;
               text-align: left; max-width: 320px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
      .steps li { margin-bottom: 8px; color: #1e293b; }
      .note { font-size: 0.78rem; color: #94a3b8; margin-top: 16px; }
    </style>
  </head>
  <body>
    <h1>📱 Vinculá WhatsApp</h1>
    <p>Escaneá este código con el celular del municipio</p>
    <img src="${botState.qrCode}" alt="QR de WhatsApp" />
    <div class="steps">
      <ol>
        <li>Abrí <strong>WhatsApp</strong> en el celular</li>
        <li>Tocá los <strong>3 puntos</strong> → <em>Dispositivos vinculados</em></li>
        <li>Tocá <strong>Vincular dispositivo</strong></li>
        <li>Apuntá la cámara a este QR</li>
      </ol>
    </div>
    <p class="note">El QR expira en 60 segundos. La página se actualiza sola.</p>
  </body>
  </html>`);
});

// ── API: estado del bot ───────────────────────────────────────
app.get("/api/status", (req, res) => {
  const uptime = botState.connectedAt
    ? Math.floor((Date.now() - botState.connectedAt) / 1000)
    : null;
  res.json({
    online: botState.online,
    connectedAt: botState.connectedAt,
    uptime,
    ultimaDesconexion: botState.ultimaDesconexion,
    motivoDesconexion: botState.motivoDesconexion,
    sesionCerrada: botState.sesionCerrada
  });
});

// ── API: estadísticas completas ───────────────────────────────
app.get("/api/stats", (req, res) => {
  try {
    res.json({
      resumen:       getResumenTotal(),
      topFaqs:       getTopFaqs(12),
      noRespondidos: getNoRespondidos(20),
      periodos:      getMensajesPorPeriodo(),
      distribucion:  getDistribucionTipos(),
      ultimos:       getUltimosMensajes(20),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: descartar preguntas sin respuesta ────────────────────
app.post("/api/no-respondidos/descartar", (req, res) => {
  try {
    const { pregunta, todas } = req.body || {};
    if (todas) {
      descartarTodasNoRespondidas();
      return res.json({ ok: true });
    }
    if (typeof pregunta === "string" && pregunta.trim()) {
      descartarNoRespondida(pregunta);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: "Parámetros inválidos" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── API: exportar historial a CSV (compatible con Excel ES) ───
function escaparCsv(val) {
  if (val == null) return "";
  let s = String(val).replace(/\r?\n/g, " ");
  // Evitar inyección de fórmulas en Excel
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[;"']/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

app.get("/api/export/csv", (req, res) => {
  try {
    const filas = getMensajesParaCsv(5000);
    const encabezado = "ID;Fecha y Hora;Usuario (Hash);Mensaje;Tema Detectado;Estado\r\n";
    const cuerpo = filas.map(f => {
      const estado = f.respondido === 1 ? "Respondido" : f.respondido === 2 ? "Descartado" : "Sin respuesta";
      return [
        f.id,
        escaparCsv(f.fecha),
        escaparCsv(f.usuario_hash),
        escaparCsv(f.pregunta),
        escaparCsv(f.faq_disparada || "Sin coincidencia"),
        estado,
      ].join(";");
    }).join("\r\n");

    const fechaHoy = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="felipe-reporte-${fechaHoy}.csv"`);
    // \uFEFF = BOM UTF-8 para que Excel en español reconozca tildes y emojis automáticamente
    res.send("\uFEFF" + encabezado + cuerpo);
  } catch (err) {
    res.status(500).send("Error al generar CSV: " + err.message);
  }
});

// ── API: descargar un backup fresco de la base (solo admin, tras iniciar sesión) ──
app.get("/api/backup/descargar", async (req, res) => {
  const { crearBackup, BACKUP_DIR } = require("./backup");
  const nombre = `manual-${Date.now()}.db.gz`;
  try {
    const ruta = await crearBackup(nombre);
    const fechaHoy = new Date().toISOString().slice(0, 10);
    res.setHeader("Cache-Control", "no-store");
    res.download(ruta, `felipe-backup-${fechaHoy}.db.gz`, () => fs.rmSync(path.join(BACKUP_DIR, nombre), { force: true }));
  } catch (err) {
    fs.rmSync(path.join(BACKUP_DIR, nombre), { force: true });
    res.status(500).send("No se pudo generar el backup: " + err.message);
  }
});

// ── Arrancar servidor ─────────────────────────────────────────
function iniciarPanel(logger) {
  if (!ADMIN_USER || !ADMIN_PASS) {
    if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production") {
      logger.error("🚨 ATENCIÓN: ADMIN_USER y ADMIN_PASS no están definidos en las variables de entorno.");
      logger.error("🚨 El panel web NO SE INICIARÁ por motivos de seguridad.");
      return; // No iniciamos la app, pero el bot de WA sigue vivo
    } else {
      logger.warn("⚠️  Corriendo en desarrollo sin credenciales definidas.");
      logger.warn("⚠️  Se usarán 'devadmin' y 'devpass' por defecto.");
      ADMIN_USER = "devadmin";
      ADMIN_PASS = "devpass";
    }
  }

  app.listen(PORT, () => {
    logger.info(`🌐 Panel disponible en http://localhost:${PORT}`);
  });
}

module.exports = { iniciarPanel };
