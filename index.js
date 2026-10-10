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
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const qrcode         = require("qrcode-terminal");
const QRCode         = require("qrcode");          // genera imagen PNG del QR para el panel
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { faqs, charla, submenus, bienvenida, noEntendido } = require("./faqs");
const { registrarMensaje } = require("./db");
const { iniciarPanel }     = require("./panel");
const botState             = require("./state");
const { notificarAlerta }  = require("./alertas");

// ── Configuración ────────────────────────────────────────────
// Carpeta donde Baileys guarda la sesión de WhatsApp
const AUTH_FOLDER = process.env.AUTH_FOLDER || "auth";

// Número de teléfono del bot para vinculación sin QR (recomendado en servidores).
// Formato: código de país + número, sin +, sin espacios. Ej: 5493834403982
// Si está definido, el bot muestra un código de 8 dígitos en los logs en lugar del QR.
const PHONE_NUMBER = process.env.PHONE_NUMBER || null;

// JID del grupo privado desde donde se publican estados de WhatsApp.
// El bot detecta automáticamente los JIDs de los grupos que le escriben (ver logs).
// Formato: 120363XXXXXXXXXX@g.us
const STATUS_GRUPO_ID = process.env.STATUS_GRUPO_ID || null;

// Rate limiting: un usuario debe esperar COOLDOWN_MS entre respuestas
// para evitar que el bot responda en bucle o sea abusado.
// En 0 = desactivado (los mensajes seguidos se responden siempre).
const COOLDOWN_MS = 0;

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

// Submenú activo por usuario: JID → { id, ts }. Expira a los 10 minutos.
const SUBMENU_TTL_MS = 10 * 60 * 1000;
const submenuActivo = new Map();

// Palabras que llevan de vuelta al menú principal
const VOLVER = ["regresar", "retornar", "retomar", "retroceder", "volver", "atras"];

// Palabras que NO son un nombre ("soy de Valle Viejo", "soy un vecino"...)
const NO_NOMBRES = new Set([
  "de", "del", "un", "una", "el", "la", "lo", "los", "las", "nuevo", "nueva", "vecino", "vecina",
  "yo", "muy", "tu", "mi", "bot", "alguien", "persona", "empleado", "empleada", "estudiante",
  "turista", "joven", "mayor", "papa", "mama", "no", "si", "para", "con", "en", "por", "que",
]);

function detectarNombre(mensaje) {
  const m = mensaje.toLowerCase().match(/(?:^|\s)(?:soy|me llamo|mi nombre es|mi nombre|me dicen)\s+([\p{L}]{2,20})/u);
  if (!m) return null;
  const palabra = m[1];
  if (NO_NOMBRES.has(normalizar(palabra))) return null;
  return palabra.charAt(0).toUpperCase() + palabra.slice(1);
}

function elegir(respuesta) {
  if (Array.isArray(respuesta)) return respuesta[Math.floor(Math.random() * respuesta.length)];
  if (typeof respuesta === "function") return respuesta();
  return respuesta;
}

// Charla casual: coincide por palabra/frase completa, no por substring
function buscarCharla(texto) {
  for (const item of charla) {
    if (item.regex && item.regex.test(texto)) return item;
    const match = item.palabras_clave.some((kw) => {
      const k = normalizar(kw);
      if (item.exacto) return texto === k;
      return new RegExp(`(^|\\s)${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s|[?!.,])`).test(texto);
    });
    if (match) return item;
  }
  return null;
}

function buscarRespuesta(mensaje, jid) {
  const texto = normalizar(mensaje);

  // Volver al menú desde cualquier lado
  const palabras = texto.split(/[^a-z0-9ñ]+/);
  if (palabras.some((p) => VOLVER.includes(p))) {
    submenuActivo.delete(jid);
    return { respuesta: bienvenida, faq: "volver", respondido: true, enviarVolver: false };
  }

  // Si el usuario está dentro de un submenú y manda una opción válida
  const activo = submenuActivo.get(jid);
  if (activo && Date.now() - activo.ts < SUBMENU_TTL_MS) {
    const opcion = submenus[activo.id].opciones[texto];
    if (opcion) {
      return { respuesta: opcion.respuesta, faq: `${activo.id}_${texto}`, respondido: true, enviarVolver: true };
    }
  }

  // Se presentó con su nombre: "hola soy Esteban", "me llamo Ana"
  const nombre = detectarNombre(mensaje);
  if (nombre) {
    submenuActivo.delete(jid);
    return {
      respuesta: `¡Hola ${nombre}! 😊 Un gusto. ¿Cómo estás?\n\nSoy *Felipe IA*, el asistente virtual del Municipio de Valle Viejo. Escribí *menú* para ver en qué puedo ayudarte.`,
      faq: "nombre",
      respondido: true,
      enviarVolver: false,
    };
  }

  if (SALUDOS.some((s) => texto === normalizar(s) || texto.includes(normalizar(s)))) {
    submenuActivo.delete(jid);
    return { respuesta: bienvenida, faq: "bienvenida", respondido: true, enviarVolver: false };
  }

  for (const item of faqs) {
    const match = item.palabras_clave.some((kw) => {
      const k = normalizar(kw);
      // Los números solo valen si el mensaje es exactamente ese número
      return /^\d+$/.test(k) ? texto === k : texto.includes(k);
    });
    if (match) {
      if (item.respuesta.tipo === "submenu") {
        submenuActivo.set(jid, { id: item.respuesta.id, ts: Date.now() });
      } else {
        submenuActivo.delete(jid);
      }
      return { respuesta: item.respuesta, faq: item.palabras_clave[0], respondido: true, enviarVolver: true };
    }
  }

  // Ninguna FAQ del municipio: probar charla casual
  const conv = buscarCharla(texto);
  if (conv) {
    return { respuesta: elegir(conv.respuesta), faq: `charla:${conv.palabras_clave[0] || "risa"}`, respondido: true, enviarVolver: false };
  }

  return { respuesta: noEntendido, faq: null, respondido: false, enviarVolver: false };
}

// ── Despachador de respuestas según tipo ─────────────────────
// Soporta: string (texto), { tipo: "ubicacion", ... }, { tipo: "lista", ... }
async function enviarRespuesta(sock, jid, respuesta) {
  if (typeof respuesta === "string") {
    await sock.sendMessage(jid, { text: respuesta });
    return;
  }
  if (respuesta.tipo === "submenu") {
    await sock.sendMessage(jid, { text: respuesta.texto });
    return;
  }

  if (respuesta.tipo === "imagen") {
    if (respuesta.texto) {
      await sock.sendMessage(jid, { text: respuesta.texto });
      await new Promise((r) => setTimeout(r, 300));
    }
    const imgPath = path.join(__dirname, "public", "docs", respuesta.archivo);
    if (fs.existsSync(imgPath)) {
      await sock.sendMessage(jid, { image: { url: imgPath } });
    } else {
      logger.error(`Falta el archivo ${imgPath}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Por el momento no puedo enviarte la imagen. Consultalo en la web: https://valleviejo.gob.ar/",
      });
    }
    return;
  }

  if (respuesta.tipo === "documento") {
    if (respuesta.texto) {
      await sock.sendMessage(jid, { text: respuesta.texto });
      await new Promise((r) => setTimeout(r, 300));
    }
    const docPath = path.join(__dirname, "public", "docs", respuesta.archivo);
    if (fs.existsSync(docPath)) {
      const msg = {
        document: { url: docPath },
        mimetype: "application/pdf",
        fileName: respuesta.nombre || respuesta.archivo,
      };
      // Vista previa (miniatura) del PDF
      if (respuesta.miniatura) {
        const thumbPath = path.join(__dirname, "public", "docs", respuesta.miniatura);
        if (fs.existsSync(thumbPath)) msg.jpegThumbnail = fs.readFileSync(thumbPath);
      }
      await sock.sendMessage(jid, msg);
    } else {
      logger.error(`Falta el archivo ${docPath}`);
      await sock.sendMessage(jid, {
        text: "⚠️ Por el momento no puedo enviarte el documento. Consultalo en la web: https://valleviejo.gob.ar/",
      });
    }
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

  if (respuesta.tipo === "bienvenida") {
    // Solo el texto del menú (el audio ahora se manda con la opción "Saludo especial")
    await sock.sendMessage(jid, { text: respuesta.texto });
    return;
  }

  if (respuesta.tipo === "audio") {
    if (respuesta.texto) {
      await sock.sendMessage(jid, { text: respuesta.texto });
      await new Promise((r) => setTimeout(r, 300));
    }
    const audioPath = path.join(__dirname, "public", "audio", respuesta.archivo);
    if (fs.existsSync(audioPath)) {
      try {
        await sock.sendMessage(jid, {
          audio:    { url: audioPath },
          mimetype: "audio/ogg; codecs=opus",
          ptt:      true,  // Se manda como nota de voz (el formato OGG Opus es nativo y lo soportan todos los celulares)
        });
      } catch (e) {
        logger.error("Error al enviar el audio:", e.message);
      }
    } else {
      logger.error(`Falta el archivo ${audioPath}`);
    }
    return;
  }

  // Fallback: convertir a string por si acaso
  await sock.sendMessage(jid, { text: String(respuesta) });
}

// ── Publicador de estados de WhatsApp ────────────────────────
// Si el mensaje viene del grupo STATUS_GRUPO_ID y tiene foto o video,
// lo descarga y lo sube automáticamente como estado de WhatsApp.
async function manejarMensajeEstado(sock, msg) {
  const imagen = msg.message?.imageMessage;
  const video  = msg.message?.videoMessage;

  // Solo procesar si hay media adjunta
  if (!imagen && !video) return;

  const tipo    = imagen ? "imagen" : "video";
  const caption = imagen?.caption || video?.caption || "";

  try {
    logger.info(`📢 [Estados] Procesando ${tipo} del grupo de estados...`);
    const buffer = await downloadMediaMessage(msg, "buffer", {});

    if (imagen) {
      await sock.sendMessage("status@broadcast", { image: buffer, caption });
    } else {
      await sock.sendMessage("status@broadcast", { video: buffer, caption, gifPlayback: false });
    }

    // Reaccionar con ✅ para confirmar la publicación
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: "✅", key: msg.key },
    });
    logger.info(`📢 [Estados] Estado publicado exitosamente (${tipo}).`);
  } catch (err) {
    logger.error(`📢 [Estados] Error al publicar estado: ${err.message}`);
    // Reaccionar con ❌ para avisar del error
    await sock.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key },
    });
  }
}

// El panel web solo debe iniciarse una vez, no en cada reconexión de WhatsApp
let panelIniciado = false;
let checkConexionInterval = null;

async function iniciarBot(intentosReconexion = 0) {
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
      botState.ultimaDesconexion = Date.now();
      
      const motivo = lastDisconnect?.error?.output?.statusCode;
      botState.motivoDesconexion = motivo;
      
      const debeReconectar = motivo !== DisconnectReason.loggedOut;
      botState.sesionCerrada = !debeReconectar;

      logger.warn(`❌ Conexión cerrada. Código: ${motivo} | Reconectar: ${debeReconectar}`);
      
      if (debeReconectar) {
        const tiempos = [2000, 5000, 10000, 30000, 60000];
        const espera = tiempos[Math.min(intentosReconexion, tiempos.length - 1)];
        logger.info(`Intentando reconectar en ${espera / 1000}s (Intento ${intentosReconexion + 1})...`);
        
        setTimeout(() => {
          iniciarBot(intentosReconexion + 1);
        }, espera);
      } else {
        logger.error("🔒 Sesión cerrada. Borrá la carpeta 'auth' y reiniciá el servicio en Railway.");
        notificarAlerta("loggedOut", "🔒 Sesión de WhatsApp cerrada. Se requiere escanear el QR de nuevo. Entrá a /qr en el panel admin.", logger);
      }
    } else if (connection === "open") {
      if (!botState.online && intentosReconexion > 0) {
        notificarAlerta("recuperacion", "✅ Felipe IA volvió a estar en línea tras desconexión.", logger);
      }
      botState.online      = true;
      botState.connectedAt = Date.now();
      botState.qrCode      = null;  // ya no se necesita el QR
      botState.ultimaDesconexion = null;
      botState.motivoDesconexion = null;
      botState.sesionCerrada = false;
      intentosReconexion = 0; // reset
      logger.info("✅ Bot conectado y funcionando.");
    }

  });
  
  // Revisión periódica de desconexión prologada
  if (!checkConexionInterval) {
    checkConexionInterval = setInterval(() => {
      if (!botState.online && botState.ultimaDesconexion) {
        const caidaMs = Date.now() - botState.ultimaDesconexion;
        if (caidaMs > 5 * 60 * 1000) { // 5 minutos
          notificarAlerta("caida_prolongada", `⚠️ Felipe IA lleva más de 5 minutos desconectado. Reintentando reconexión internamente.`, logger);
        }
      }
    }, 60000);
  }

  // ── Escucha de mensajes entrantes ────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    // Solo responder en chats individuales, no en grupos...
    // EXCEPCIÓN: el grupo de estados se maneja aparte.
    const esGrupo = msg.key.remoteJid?.endsWith("@g.us");
    if (esGrupo) {
      // Logear el JID del grupo para facilitar la config de STATUS_GRUPO_ID
      if (!STATUS_GRUPO_ID) {
        logger.info(`[Grupos] Mensaje de grupo detectado. JID: ${msg.key.remoteJid} — copialo a la variable STATUS_GRUPO_ID si es el grupo de estados.`);
      }
      // Si es el grupo de estados configurado, procesar como publicación
      if (STATUS_GRUPO_ID && msg.key.remoteJid === STATUS_GRUPO_ID) {
        await manejarMensajeEstado(sock, msg);
      }
      return;
    }

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
      const { respuesta, faq, respondido, enviarVolver } = buscarRespuesta(texto, remitente);

      registrarRespuesta(remitente);
      registrarMensaje({ jid: remitente, pregunta: texto, faqDisparada: faq, respondido });

      await sock.sendPresenceUpdate("composing", remitente);
      await new Promise((r) => setTimeout(r, 800));

      await enviarRespuesta(sock, remitente, respuesta);

      // Mensaje separado al final: cómo volver al menú
      if (enviarVolver) {
        await new Promise((r) => setTimeout(r, 600));
        await sock.sendMessage(remitente, { text: "↩️ Escribí *menú* para volver al inicio o elegir otra opción." });
      }

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

