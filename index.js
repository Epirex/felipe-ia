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
const qrcode         = require("qrcode-terminal");
const QRCode         = require("qrcode");          // genera imagen PNG del QR para el panel
const pino = require("pino");
const { faqs, bienvenida, noEntendido } = require("./faqs");
const { registrarMensaje } = require("./db");
const { iniciarPanel }     = require("./panel");
const botState             = require("./state");

// ── Configuración ────────────────────────────────────────────
// Carpeta donde Baileys guarda la sesión de WhatsApp
const AUTH_FOLDER = process.env.AUTH_FOLDER || "auth";

// Número de teléfono del bot para vinculación sin QR (recomendado en servidores).
// Formato: código de país + número, sin +, sin espacios. Ej: 5493834403982
// Si está definido, el bot muestra un código de 8 dígitos en los logs en lugar del QR.
const PHONE_NUMBER = process.env.PHONE_NUMBER || null;

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

// ── Despachador de respuestas según tipo ─────────────────────
// Soporta: string (texto), { tipo: "ubicacion", ... }, { tipo: "lista", ... }
async function enviarRespuesta(sock, jid, respuesta) {
  if (typeof respuesta === "string") {
    await sock.sendMessage(jid, { text: respuesta });
    return;
  }

  if (respuesta.tipo === "ubicacion") {
    // Primero el texto introductorio, luego el pin
    if (respuesta.texto) {
      await sock.sendMessage(jid, { text: respuesta.texto });
      await new Promise((r) => setTimeout(r, 300));
    }
    await sock.sendMessage(jid, {
      location: {
        degreesLatitude:  respuesta.latitud,
        degreesLongitude: respuesta.longitud,
        name:    respuesta.nombre,
        address: respuesta.direccion,
      },
    });
    return;
  }

  if (respuesta.tipo === "lista") {
    // Si hay audio de bienvenida configurado, mandarlo primero como nota de voz
    const audioUrl = process.env.PUBLIC_URL
      ? `${process.env.PUBLIC_URL}/audio/felipebienvenida.mp3`
      : null;

    if (audioUrl) {
      try {
        await sock.sendMessage(jid, {
          audio:    { url: audioUrl },
          mimetype: "audio/mpeg",
          ptt:      true,  // aparece como nota de voz, no como archivo
        });
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        // Si falla el audio, seguimos igual con el menú
      }
    }

    await sock.sendMessage(jid, {
      text:        respuesta.texto,
      footer:      respuesta.pie,
      title:       "",
      buttonText:  respuesta.boton,
      sections:    respuesta.secciones.map((s) => ({
        title: s.titulo,
        rows:  s.filas.map((f) => ({
          id:          f.id,
          title:       f.titulo,
          description: f.descripcion || "",
        })),
      })),
    });
    return;
  }

  // Fallback: convertir a string por si acaso
  await sock.sendMessage(jid, { text: String(respuesta) });
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
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
  });

  sock.ev.on("creds.update", saveCreds);

  // ── Vinculación: pairing code (servidor) o QR (local) ────────
  if (PHONE_NUMBER && !sock.authState.creds.registered) {
    // Esperar un momento antes de pedir el código
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      logger.info("═══════════════════════════════════════════");
      logger.info(`📱 CÓDIGO DE VINCULACIÓN: ${code}`);
      logger.info("Abrí WhatsApp > Dispositivos vinculados >");
      logger.info("Vincular con número de teléfono > ingresá el código");
      logger.info("═══════════════════════════════════════════");
    } catch (err) {
      logger.error("No se pudo obtener el código de vinculación:", err.message);
    }
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Generar QR como imagen y guardarlo en el estado para el panel web
      try {
        botState.qrCode = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        logger.info("📱 QR listo — abrí el panel en tu celular y escanealo desde /qr");
      } catch (e) {
        logger.error("No se pudo generar imagen del QR:", e.message);
      }
      // También mostrar en terminal (útil en desarrollo local)
      if (!PHONE_NUMBER) qrcode.generate(qr, { small: true });
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
        logger.error("🔒 Sesión cerrada. Borrá la carpeta 'auth' y reiniciá el servicio en Railway.");
      }
    } else if (connection === "open") {
      botState.online      = true;
      botState.connectedAt = Date.now();
      botState.qrCode      = null;  // ya no se necesita el QR
      logger.info("✅ Bot conectado y funcionando.");
    }

  });

  // ── Escucha de mensajes entrantes ────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    // Solo responder en chats individuales, no en grupos
    const esGrupo = msg.key.remoteJid?.endsWith("@g.us");
    if (esGrupo) return;

    const remitente = msg.key.remoteJid;

    // ── Rate limiting ─────────────────────────────────────────
    if (enCooldown(remitente)) {
      logger.warn(`⏳ Rate limit activo para ${remitente}, mensaje ignorado.`);
      return;
    }

    // Captura texto normal Y selecciones de lista interactiva
    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg.message.imageMessage?.caption ||
      "";

    if (!texto) return;

    logger.info(`📩 Mensaje de ${remitente}: ${texto}`);

    try {
      const { respuesta, faq, respondido } = buscarRespuesta(texto);

      registrarRespuesta(remitente);
      registrarMensaje({ jid: remitente, pregunta: texto, faqDisparada: faq, respondido });

      await sock.sendPresenceUpdate("composing", remitente);
      await new Promise((r) => setTimeout(r, 800));

      await enviarRespuesta(sock, remitente, respuesta);
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

