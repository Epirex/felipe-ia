// ============================================================
// BACKUPS DE LA BASE DE DATOS (reclamos, estadísticas, usuarios de áreas)
//
// - Una copia por día (SQLite VACUUM INTO, comprimida con gzip) en BACKUP_DIR.
// - Rotación: se conservan los últimos BACKUP_DIAS días (por defecto 14).
// - Opcional, copia FUERA del servidor: si están RESEND_API_KEY y BACKUP_EMAIL_TO,
//   la copia del día se manda por mail como adjunto (no depende del volumen de Railway).
//   OJO: contiene datos personales (DNI, domicilio). Usar una casilla institucional.
// - Descarga manual desde el panel: /api/backup/descargar (requiere login de admin).
//
// Variables: BACKUP_DIR, BACKUP_DIAS, BACKUP_EMAIL_TO, BACKUP_DESACTIVADO=1
// Restaurar: ver README ("Restaurar un backup").
// ============================================================

const fs   = require("fs");
const path = require("path");
const zlib = require("zlib");
const { pipeline } = require("stream/promises");
const { DB_DIR, respaldarA } = require("./db");

const BACKUP_DIR  = process.env.BACKUP_DIR || path.join(DB_DIR, "backups");
const BACKUP_DIAS = Math.max(1, Number(process.env.BACKUP_DIAS) || 14);
const EMAIL_TO    = process.env.BACKUP_EMAIL_TO || null;
const RESEND_KEY  = process.env.RESEND_API_KEY || null;
const MAX_ADJUNTO = 25 * 1024 * 1024; // Resend admite ~40 MB en total; dejamos margen
const PREFIJO     = "bot-";
const SUFIJO      = ".db.gz";

function hoyLocal() {
  // YYYY-MM-DD en hora de Catamarca (sv-SE da ese formato)
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Catamarca" });
}

// Crea la copia comprimida con nombre `bot-<fecha>.db.gz` y devuelve su ruta.
async function crearBackup(nombre = `${PREFIJO}${hoyLocal()}${SUFIJO}`) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const tmpDb = path.join(BACKUP_DIR, `.tmp-${process.pid}-${Date.now()}.db`);
  const destino = path.join(BACKUP_DIR, nombre);
  const tmpGz = destino + ".tmp";
  try {
    respaldarA(tmpDb);
    await pipeline(fs.createReadStream(tmpDb), zlib.createGzip({ level: 9 }), fs.createWriteStream(tmpGz));
    fs.renameSync(tmpGz, destino); // rename atómico: nunca queda un backup a medio escribir
  } finally {
    fs.rmSync(tmpDb, { force: true });
    fs.rmSync(tmpGz, { force: true });
  }
  return destino;
}

function listarBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(PREFIJO) && f.endsWith(SUFIJO))
    .sort(); // el nombre lleva la fecha: orden alfabético = cronológico
}

function rotar(logger) {
  const todos = listarBackups();
  const sobran = todos.slice(0, Math.max(0, todos.length - BACKUP_DIAS));
  for (const f of sobran) {
    fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
    logger?.info(`💾 [Backup] Eliminado backup antiguo: ${f}`);
  }
}

async function enviarPorMail(ruta, logger) {
  if (!EMAIL_TO || !RESEND_KEY) return;
  const { size } = fs.statSync(ruta);
  if (size > MAX_ADJUNTO) {
    logger?.warn(`💾 [Backup] ${path.basename(ruta)} pesa ${(size / 1048576).toFixed(1)} MB: demasiado grande para mandarlo por mail.`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Felipe IA Bot <onboarding@resend.dev>",
        to: [EMAIL_TO],
        subject: `[Backup] Felipe IA — ${hoyLocal()}`,
        text: "Copia diaria de la base de datos de Felipe IA (adjunta, comprimida con gzip). Contiene datos personales: guardala en un lugar seguro.",
        attachments: [{ filename: path.basename(ruta), content: fs.readFileSync(ruta).toString("base64") }],
      }),
    });
    if (res.ok) logger?.info(`💾 [Backup] Copia enviada por mail a ${EMAIL_TO}.`);
    else logger?.error(`💾 [Backup] Resend rechazó el adjunto (${res.status}): ${(await res.text()).slice(0, 200)}`);
  } catch (err) {
    logger?.error(`💾 [Backup] No se pudo enviar el backup por mail: ${err.message}`);
  }
}

// Hace el backup del día si todavía no existe. Nunca lanza: un fallo de backup no debe tumbar el bot.
async function backupDelDia(logger, notificarAlerta) {
  try {
    const nombre = `${PREFIJO}${hoyLocal()}${SUFIJO}`;
    if (fs.existsSync(path.join(BACKUP_DIR, nombre))) return;
    const ruta = await crearBackup(nombre);
    logger?.info(`💾 [Backup] Creado ${nombre} (${(fs.statSync(ruta).size / 1024).toFixed(0)} KB) en ${BACKUP_DIR}`);
    rotar(logger);
    await enviarPorMail(ruta, logger);
  } catch (err) {
    logger?.error(`💾 [Backup] FALLÓ el backup diario: ${err.message}`);
    notificarAlerta?.("backup_fallido", `⚠️ Falló el backup diario de la base de datos de Felipe IA: ${err.message}`, logger);
  }
}

// Revisa cada hora si falta el backup del día (así un reinicio o deploy no saltea ninguno).
function iniciarBackups(logger, notificarAlerta) {
  if (process.env.BACKUP_DESACTIVADO === "1") {
    logger?.warn("💾 [Backup] Desactivado por BACKUP_DESACTIVADO=1.");
    return;
  }
  if (!process.env.DB_PATH && (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production")) {
    logger?.warn("💾 [Backup] DB_PATH no está definido: la base y sus backups pueden perderse en cada deploy. Configurá un volumen.");
  }
  setTimeout(() => backupDelDia(logger, notificarAlerta), 30 * 1000).unref?.();
  setInterval(() => backupDelDia(logger, notificarAlerta), 60 * 60 * 1000).unref?.();
  logger?.info(`💾 [Backup] Activo: 1 por día en ${BACKUP_DIR}, se conservan ${BACKUP_DIAS}.${EMAIL_TO && RESEND_KEY ? ` Copia por mail a ${EMAIL_TO}.` : ""}`);
}

module.exports = { iniciarBackups, backupDelDia, crearBackup, listarBackups, BACKUP_DIR };
