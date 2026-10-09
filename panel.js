// ============================================================
// SERVIDOR WEB — PANEL ADMINISTRATIVO
// Express sirve el dashboard y expone rutas /api/*
// Protegido con usuario y contraseña (Basic Auth)
// ============================================================

const express = require("express");
const path    = require("path");
const crypto  = require("crypto");
const {
  getResumenTotal,
  getTopFaqs,
  getNoRespondidos,
  getMensajesPorPeriodo,
} = require("./db");
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

// ── Autenticación básica ──────────────────────────────────────
function basicAuth(req, res, next) {
  const ip = req.ip;
  const ahora = Date.now();
  const estadoIP = fallosAuth.get(ip) || { intentos: 0, timestamp: ahora };

  if (ahora - estadoIP.timestamp > TIEMPO_BLOQUEO) {
    estadoIP.intentos = 0;
    estadoIP.timestamp = ahora;
  }

  if (estadoIP.intentos >= MAX_FALLOS) {
    fallosAuth.set(ip, estadoIP);
    return res.status(429).send("Demasiados intentos fallidos. Intente más tarde.");
  }

  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Felipe IA Admin"');
    return res.status(401).send("Se requiere autenticación");
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString();
  const colonIdx = decoded.indexOf(":");
  const user = decoded.slice(0, colonIdx);
  const pass = decoded.slice(colonIdx + 1);

  // Buffer para comparar hashes SHA-256
  const hashIngresadoUser = crypto.createHash('sha256').update(user).digest();
  const hashRealUser = crypto.createHash('sha256').update(ADMIN_USER).digest();
  
  const hashIngresadoPass = crypto.createHash('sha256').update(pass).digest();
  const hashRealPass = crypto.createHash('sha256').update(ADMIN_PASS).digest();

  const userOk = crypto.timingSafeEqual(hashIngresadoUser, hashRealUser);
  const passOk = crypto.timingSafeEqual(hashIngresadoPass, hashRealPass);

  if (userOk && passOk) {
    // Éxito: limpiar intentos
    fallosAuth.delete(ip);
    return next();
  }

  estadoIP.intentos++;
  estadoIP.timestamp = ahora;
  fallosAuth.set(ip, estadoIP);

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
