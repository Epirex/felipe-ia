// ============================================================
// BOT DE WHATSAPP - MUNICIPIO
// Librería: Baileys (@whiskeysockets/baileys)
// No usa navegador/Puppeteer -> mucho más estable que whatsapp-web.js
// ============================================================

const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");
const { faqs, bienvenida, noEntendido } = require("./faqs");
const { registrarMensaje } = require("./db");
const { iniciarPanel }     = require("./panel");
const botState             = require("./state");

// ── Configuración ────────────────────────────────────────────
// Carpeta donde Baileys guarda la sesión de WhatsApp
const AUTH_FOLDER = process.env.AUTH_FOLDER || "auth";

// Rate limiting: un usuario debe esperar COOLDOWN_MS entre respuestas
// para evitar que el bot responda en bucle o sea abusado.
const COOLDOWN_MS = 5000; // 5 segundos

// ── Logs con fecha/hora ───────────────────────────────────────
function log(nivel, ...args) {
  const ts = new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Catamarca" });
  console.log(`[${ts}] [${nivel}]`, ...args);
}
const logger = {
  info:  (...a) => log("INFO ", ...a),
  warn:  (...a) => log("WARN ", ...a),
  error: (...a) => log("ERROR", ...a),
};

// ── Rate limiting ─────────────────────────────────────────────
// Mapa: JID del usuario → timestamp del último mensaje respondido
const ultimaRespuesta = new Map();

function enCooldown(jid) {
  const ultimo = ultimaRespuesta.get(jid);
  if (!ultimo) return false;
  return Date.now() - ultimo < COOLDOWN_MS;
}

function registrarRespuesta(jid) {
  ultimaRespuesta.set(jid, Date.now());
  // Limpiar entradas viejas cada 500 usuarios para no acumular memoria
  if (ultimaRespuesta.size > 500) {
    const limite = Date.now() - COOLDOWN_MS * 2;
    for (const [k, v] of ultimaRespuesta) {
      if (v < limite) ultimaRespuesta.delete(k);
    }
  }
}

// ── Palabras que disparan el menú de bienvenida ───────────────
const SALUDOS = ["hola", "buenas", "buen dia", "buen día", "buenas tardes", "buenas noches", "menu", "menú", "ayuda"];

function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // saca tildes para comparar más fácil
    .trim();
}

function buscarRespuesta(mensaje) {
  const texto = normalizar(mensaje);

  if (SALUDOS.some((s) => texto === normalizar(s) || texto.includes(normalizar(s)))) {
    return { respuesta: bienvenida, faq: "bienvenida", respondido: true };
  }

  for (const item of faqs) {
    const match = item.palabras_clave.some((kw) => texto.includes(normalizar(kw)));
    if (match) {
      return { respuesta: item.respuesta, faq: item.palabras_clave[0], respondido: true };
    }
  }

  return { respuesta: noEntendido, faq: null, respondido: false };
}

// El panel web solo debe iniciarse una vez, no en cada reconexión de WhatsApp
let panelIniciado = false;

async function iniciarBot() {
  // Guarda la sesión en la carpeta ./auth para no tener que escanear
  // el QR cada vez que reinicies el bot.
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }), // poné "info" si querés ver logs detallados
    printQRInTerminal: false, // lo manejamos nosotros abajo para más control
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escaneá este QR con WhatsApp > Dispositivos vinculados:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      botState.online      = false;
      botState.connectedAt = null;
      const motivo = lastDisconnect?.error?.output?.statusCode;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;
      logger.warn(`❌ Conexión cerrada. Código: ${motivo} | Reconectar: ${debeReconectar}`);
      if (debeReconectar) {
        logger.info("Intentando reconectar...");
        iniciarBot();
      } else {
        logger.error("🔒 Sesión cerrada (logout). Borrá la carpeta 'auth' y volvé a escanear el QR.");
      }
    } else if (connection === "open") {
      botState.online      = true;
      botState.connectedAt = Date.now();
      logger.info("✅ Bot conectado y funcionando.");
    }
  });

  // ── Escucha de mensajes entrantes ────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return; // ignora mensajes propios y vacíos

    // Solo responder en chats individuales, no en grupos
    const esGrupo = msg.key.remoteJid?.endsWith("@g.us");
    if (esGrupo) return;

    const remitente = msg.key.remoteJid;

    // ── Rate limiting ─────────────────────────────────────────
    if (enCooldown(remitente)) {
      logger.warn(`⏳ Rate limit activo para ${remitente}, mensaje ignorado.`);
      return;
    }

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      "";

    if (!texto) return;

    logger.info(`📩 Mensaje de ${remitente}: ${texto}`);

    try {
      const { respuesta, faq, respondido } = buscarRespuesta(texto);

      // Registrar en rate limiter y en base de datos
      registrarRespuesta(remitente);
      registrarMensaje({ jid: remitente, pregunta: texto, faqDisparada: faq, respondido });

      // Simula "escribiendo..." para que se sienta más natural
      await sock.sendPresenceUpdate("composing", remitente);
      await new Promise((r) => setTimeout(r, 800));

      await sock.sendMessage(remitente, { text: respuesta });
      logger.info(`✉️  Respuesta enviada a ${remitente} [faq: ${faq || "sin match"}].`);
    } catch (err) {
      logger.error(`No se pudo enviar respuesta a ${remitente}:`, err.message);
    }
  });

  // ── Arrancar panel web (solo la primera vez, no en reconexiones) ──
  if (!panelIniciado) {
    iniciarPanel(logger);
    panelIniciado = true;
  }
}

iniciarBot().catch((err) => logger.error("Error crítico al iniciar el bot:", err));

