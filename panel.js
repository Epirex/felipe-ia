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

app.use(basicAuth);

// ── Dashboard HTML ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
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
