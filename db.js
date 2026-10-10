// ============================================================
// CAPA DE BASE DE DATOS — SQLite (node:sqlite, incluido en Node.js v22+)
// Guarda cada mensaje que llega al bot para estadísticas.
// No requiere dependencias externas ni compilación nativa.
// ============================================================

const { DatabaseSync } = require("node:sqlite");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// La carpeta "data/" almacena el archivo .db
// En Railway debe estar en un volumen persistente montado en /app/data
const DB_DIR = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, "data");
const DB_FILE = process.env.DB_PATH || path.join(__dirname, "data", "bot.db");

// Crear carpeta si no existe
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new DatabaseSync(DB_FILE);

// ── Crear tablas e índices ────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS mensajes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    usuario_hash  TEXT    NOT NULL,
    pregunta      TEXT    NOT NULL,
    faq_disparada TEXT,
    respondido    INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_fecha   ON mensajes(fecha);
  CREATE INDEX IF NOT EXISTS idx_faq     ON mensajes(faq_disparada);
  CREATE INDEX IF NOT EXISTS idx_usuario ON mensajes(usuario_hash);

  CREATE TABLE IF NOT EXISTS contactos (
    jid  TEXT PRIMARY KEY,
    visto_en TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// ── Privacidad: hashear el JID del usuario ────────────────────
// Se guarda solo los primeros 16 caracteres del hash SHA-256.
// Permite contar usuarios únicos sin guardar números de teléfono.
function hashUsuario(jid) {
  return crypto.createHash("sha256").update(jid).digest("hex").slice(0, 16);
}

// ── Contactos conocidos (para estados de WhatsApp) ────────────
// El JID se guarda tal cual (no hasheado) porque se necesita para enviar estados.
const _registrarContactoStmt = db.prepare(`
  INSERT INTO contactos (jid) VALUES (?)
  ON CONFLICT(jid) DO UPDATE SET visto_en = datetime('now', 'localtime')
`);

function registrarContacto(jid) {
  try {
    _registrarContactoStmt.run(jid);
  } catch (_) { /* ignorar errores silenciosamente */ }
}

function getContactosConocidos() {
  return db.prepare("SELECT jid FROM contactos WHERE jid LIKE '%@s.whatsapp.net'").all().map(r => r.jid);
}


function registrarMensaje({ jid, pregunta, faqDisparada, respondido }) {
  db.prepare(`
    INSERT INTO mensajes (usuario_hash, pregunta, faq_disparada, respondido)
    VALUES (?, ?, ?, ?)
  `).run(
    hashUsuario(jid),
    pregunta.slice(0, 500),   // limitar largo por seguridad
    faqDisparada || null,
    respondido ? 1 : 0
  );
}

// ── Consultas de estadísticas ─────────────────────────────────

function getResumenTotal() {
  const total     = db.prepare("SELECT COUNT(*) as n FROM mensajes").get().n;
  const sinResp   = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE respondido = 0").get().n;
  const usuarios  = db.prepare("SELECT COUNT(DISTINCT usuario_hash) as n FROM mensajes").get().n;
  const hoy       = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE date(fecha) = date('now','localtime')").get().n;
  const semana    = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE date(fecha) >= date('now','localtime','-7 days')").get().n;
  const mes       = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE strftime('%Y-%m',fecha) = strftime('%Y-%m','now','localtime')").get().n;
  const anio      = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE strftime('%Y',fecha) = strftime('%Y','now','localtime')").get().n;

  return { totalMensajes: total, sinRespuesta: sinResp, usuariosUnicos: usuarios, hoy, estaSemana: semana, esteMes: mes, esteAnio: anio };
}

function getMensajesPorDia(dias = 30) {
  return db.prepare(`
    SELECT date(fecha) as dia, COUNT(*) as total
    FROM mensajes
    WHERE date(fecha) >= date('now','localtime',?)
    GROUP BY dia ORDER BY dia ASC
  `).all(`-${dias} days`);
}

function getMensajesPorSemana(semanas = 12) {
  return db.prepare(`
    SELECT strftime('%Y-W%W', fecha) as semana, COUNT(*) as total
    FROM mensajes
    WHERE date(fecha) >= date('now','localtime',?)
    GROUP BY semana ORDER BY semana ASC
  `).all(`-${semanas * 7} days`);
}

function getMensajesPorMes(meses = 12) {
  return db.prepare(`
    SELECT strftime('%Y-%m', fecha) as mes, COUNT(*) as total
    FROM mensajes
    WHERE date(fecha) >= date('now','localtime',?)
    GROUP BY mes ORDER BY mes ASC
  `).all(`-${meses} months`);
}

function getTopFaqs(limit = 10) {
  return db.prepare(`
    SELECT faq_disparada, COUNT(*) as total
    FROM mensajes
    WHERE faq_disparada IS NOT NULL
      AND faq_disparada NOT IN ('bienvenida')
    GROUP BY faq_disparada
    ORDER BY total DESC
    LIMIT ?
  `).all(limit);
}

function getNoRespondidos(limit = 20) {
  return db.prepare(`
    SELECT pregunta, COUNT(*) as total
    FROM mensajes
    WHERE respondido = 0
    GROUP BY lower(trim(pregunta))
    ORDER BY total DESC
    LIMIT ?
  `).all(limit);
}

function getMensajesPorPeriodo() {
  return {
    porDia:    getMensajesPorDia(30),
    porSemana: getMensajesPorSemana(12),
    porMes:    getMensajesPorMes(12),
  };
}

module.exports = {
  registrarMensaje,
  registrarContacto,
  getContactosConocidos,
  getResumenTotal,
  getTopFaqs,
  getNoRespondidos,
  getMensajesPorPeriodo,
};
