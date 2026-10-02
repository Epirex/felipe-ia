// ============================================================
// SERVIDOR WEB — PANEL ADMINISTRATIVO
// Express sirve el dashboard y expone rutas /api/*
// Protegido con usuario y contraseña (Basic Auth)
// ============================================================

const express = require("express");
const path    = require("path");
const {
  getResumenTotal,
  getTopFaqs,
  getNoRespondidos,
  getMensajesPorPeriodo,
} = require("./db");
const botState = require("./state");

// ── Configuración ─────────────────────────────────────────────
// Definí ADMIN_USER y ADMIN_PASS en las variables de entorno de Railway.
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "felipeia2025";
const PORT       = process.env.PORT || 3000;

const app = express();

// ── Autenticación básica ──────────────────────────────────────
function basicAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Felipe IA Admin"');
    return res.status(401).send("Se requiere autenticación");
  }
  const decoded    = Buffer.from(header.slice(6), "base64").toString();
  const colonIdx   = decoded.indexOf(":");
  const user       = decoded.slice(0, colonIdx);
  const pass       = decoded.slice(colonIdx + 1);
  if (user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.setHeader("WWW-Authenticate", 'Basic realm="Felipe IA Admin"');
  return res.status(401).send("Usuario o contraseña incorrectos");
}

// ── Archivos estáticos (audio, imágenes, etc.) públicos ───────
app.use("/audio", express.static(path.join(__dirname, "public", "audio")));

app.use(basicAuth);

// ── Dashboard HTML ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// ── Página del QR para escanear ───────────────────────────────
app.get("/qr", (req, res) => {
  if (botState.online) {
    return res.send(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Felipe IA — QR</title>
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
      <title>Felipe IA — QR</title>
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
    <title>Felipe IA — Escanear QR</title>
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
    online:      botState.online,
    connectedAt: botState.connectedAt,
    uptime,
  });
});

// ── API: estadísticas completas ───────────────────────────────
app.get("/api/stats", (req, res) => {
  try {
    res.json({
      resumen:       getResumenTotal(),
      topFaqs:       getTopFaqs(10),
      noRespondidos: getNoRespondidos(20),
      periodos:      getMensajesPorPeriodo(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Arrancar servidor ─────────────────────────────────────────
function iniciarPanel(logger) {
  app.listen(PORT, () => {
    logger.info(`🌐 Panel disponible en http://localhost:${PORT}`);
  });
}

module.exports = { iniciarPanel };
