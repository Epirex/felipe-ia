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

  CREATE TABLE IF NOT EXISTS reclamos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    nombre     TEXT    NOT NULL,
    dni        TEXT    NOT NULL,
    domicilio  TEXT    NOT NULL,
    detalle    TEXT    NOT NULL,
    telefono   TEXT,
    via_audio  INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON reclamos(fecha);
`);

// Migración: agregar la columna "categoria" a bases que ya tenían la tabla reclamos
if (!db.prepare("PRAGMA table_info(reclamos)").all().some((c) => c.name === "categoria")) {
  db.exec("ALTER TABLE reclamos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Otro'");
}

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
  // Incluimos tanto @s.whatsapp.net como @lid (protocolo multi-device de Baileys 6.x)
  // Excluimos grupos (@g.us) y broadcast (@broadcast)
  return db.prepare(
    "SELECT jid FROM contactos WHERE jid NOT LIKE '%@g.us' AND jid NOT LIKE '%@broadcast'"
  ).all().map(r => r.jid);
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
  const audios    = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE pregunta LIKE '🎙️%'").get().n;
  const hoy       = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE date(fecha) = date('now','localtime')").get().n;
  const semana    = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE date(fecha) >= date('now','localtime','-7 days')").get().n;
  const mes       = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE strftime('%Y-%m',fecha) = strftime('%Y-%m','now','localtime')").get().n;
  const anio      = db.prepare("SELECT COUNT(*) as n FROM mensajes WHERE strftime('%Y',fecha) = strftime('%Y','now','localtime')").get().n;

  return { totalMensajes: total, sinRespuesta: sinResp, usuariosUnicos: usuarios, audios, hoy, estaSemana: semana, esteMes: mes, esteAnio: anio };
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

function getMensajesPorHora() {
  const filas = db.prepare(`
    SELECT CAST(strftime('%H', fecha) AS INTEGER) as hora, COUNT(*) as total
    FROM mensajes
    GROUP BY hora ORDER BY hora ASC
  `).all();
  const mapa = new Map(filas.map(f => [f.hora, f.total]));
  return Array.from({ length: 24 }, (_, h) => ({
    hora: `${String(h).padStart(2, "0")}:00`,
    total: mapa.get(h) || 0,
  }));
}

function getDistribucionTipos() {
  const municipales = db.prepare(`
    SELECT COUNT(*) as n FROM mensajes
    WHERE respondido != 0
      AND faq_disparada IS NOT NULL
      AND faq_disparada NOT IN ('bienvenida', 'volver', 'nombre', 'media_sin_texto')
      AND faq_disparada NOT LIKE 'charla:%'
  `).get().n;

  const menu = db.prepare(`
    SELECT COUNT(*) as n FROM mensajes
    WHERE faq_disparada IN ('bienvenida', 'volver')
  `).get().n;

  const charla = db.prepare(`
    SELECT COUNT(*) as n FROM mensajes
    WHERE faq_disparada LIKE 'charla:%' OR faq_disparada = 'nombre'
  `).get().n;

  const sinRespuesta = db.prepare(`
    SELECT COUNT(*) as n FROM mensajes
    WHERE respondido = 0
  `).get().n;

  return { municipales, menu, charla, sinRespuesta };
}

function getTopFaqs(limit = 12) {
  return db.prepare(`
    SELECT faq_disparada, COUNT(*) as total
    FROM mensajes
    WHERE faq_disparada IS NOT NULL
      AND faq_disparada NOT IN ('bienvenida', 'volver', 'nombre', 'media_sin_texto')
      AND faq_disparada NOT LIKE 'charla:%'
    GROUP BY faq_disparada
    ORDER BY total DESC
    LIMIT ?
  `).all(limit);
}

function getNoRespondidos(limit = 20) {
  return db.prepare(`
    SELECT MIN(pregunta) as pregunta, COUNT(*) as total, MAX(fecha) as ultima_fecha
    FROM mensajes
    WHERE respondido = 0
    GROUP BY lower(trim(pregunta))
    ORDER BY total DESC, ultima_fecha DESC
    LIMIT ?
  `).all(limit);
}

function descartarNoRespondida(pregunta) {
  return db.prepare(`
    UPDATE mensajes
    SET respondido = 2
    WHERE respondido = 0 AND lower(trim(pregunta)) = lower(trim(?))
  `).run(pregunta);
}

function descartarTodasNoRespondidas() {
  return db.prepare(`
    UPDATE mensajes
    SET respondido = 2
    WHERE respondido = 0
  `).run();
}

function getUltimosMensajes(limit = 20) {
  return db.prepare(`
    SELECT id, fecha, usuario_hash, pregunta, faq_disparada, respondido
    FROM mensajes
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

function getMensajesParaCsv(limit = 5000) {
  return db.prepare(`
    SELECT id, fecha, usuario_hash, pregunta, faq_disparada, respondido
    FROM mensajes
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

function getMensajesPorPeriodo() {
  return {
    porDia:    getMensajesPorDia(30),
    porSemana: getMensajesPorSemana(12),
    porMes:    getMensajesPorMes(12),
    porHora:   getMensajesPorHora(),
  };
}

// ── Reclamos ──────────────────────────────────────────────────
// Se guardan con los datos reales que el ciudadano brinda (nombre, DNI, teléfono).
function guardarReclamo({ nombre, dni, domicilio, categoria, detalle, telefono, viaAudio }) {
  db.prepare(`
    INSERT INTO reclamos (nombre, dni, domicilio, categoria, detalle, telefono, via_audio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, dni, domicilio, categoria || "Otro", detalle, telefono || null, viaAudio ? 1 : 0);
}

function getReclamos(limit = 5000) {
  return db.prepare(`
    SELECT id, fecha, nombre, dni, domicilio, categoria, detalle, telefono, via_audio
    FROM reclamos
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

// Devuelve true si se modificó algún reclamo
function actualizarReclamo(id, { nombre, dni, domicilio, categoria, detalle, telefono }) {
  const r = db.prepare(`
    UPDATE reclamos
    SET nombre = ?, dni = ?, domicilio = ?, categoria = ?, detalle = ?, telefono = ?
    WHERE id = ?
  `).run(nombre, dni, domicilio, categoria, detalle, telefono || null, id);
  return r.changes > 0;
}

function eliminarReclamo(id) {
  return db.prepare("DELETE FROM reclamos WHERE id = ?").run(id).changes > 0;
}

function getEstadisticasReclamos() {
  const total = db.prepare("SELECT COUNT(*) AS n FROM reclamos").get().n;
  const hoy = db.prepare("SELECT COUNT(*) AS n FROM reclamos WHERE date(fecha) = date('now', 'localtime')").get().n;
  const semana = db.prepare("SELECT COUNT(*) AS n FROM reclamos WHERE fecha >= datetime('now', 'localtime', '-7 days')").get().n;
  const mes = db.prepare("SELECT COUNT(*) AS n FROM reclamos WHERE fecha >= datetime('now', 'localtime', '-30 days')").get().n;
  const porCategoria = db.prepare(`
    SELECT categoria, COUNT(*) AS total FROM reclamos GROUP BY categoria ORDER BY total DESC
  `).all();
  const porDia = db.prepare(`
    SELECT date(fecha) AS dia, COUNT(*) AS total FROM reclamos
    WHERE fecha >= datetime('now', 'localtime', '-13 days')
    GROUP BY dia ORDER BY dia
  `).all();
  return { total, hoy, semana, mes, porCategoria, porDia };
}

module.exports = {
  guardarReclamo,
  getReclamos,
  actualizarReclamo,
  eliminarReclamo,
  getEstadisticasReclamos,
  registrarMensaje,
  registrarContacto,
  getContactosConocidos,
  getResumenTotal,
  getTopFaqs,
  getNoRespondidos,
  descartarNoRespondida,
  descartarTodasNoRespondidas,
  getUltimosMensajes,
  getMensajesParaCsv,
  getDistribucionTipos,
  getMensajesPorPeriodo,
};
