// ============================================================
// BOT DE WHATSAPP - MUNICIPIO
// Librería: Baileys (@whiskeysockets/baileys)
// No usa navegador/Puppeteer -> mucho más estable que whatsapp-web.js
// ============================================================

// Baileys 7 es un módulo ESM: se carga con import() dinámico dentro de iniciarBot().
let makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
    downloadMediaMessage, generateWAMessage;
async function cargarBaileys() {
  if (makeWASocket) return;
  const b = await import("@whiskeysockets/baileys");
  makeWASocket              = b.default || b.makeWASocket;
  useMultiFileAuthState     = b.useMultiFileAuthState;
  DisconnectReason          = b.DisconnectReason;
  fetchLatestBaileysVersion = b.fetchLatestBaileysVersion;
  downloadMediaMessage      = b.downloadMediaMessage;
  generateWAMessage         = b.generateWAMessage;
}
const qrcode         = require("qrcode-terminal");
const QRCode         = require("qrcode");          // genera imagen PNG del QR para el panel
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const { faqs, charla, submenus, bienvenida, noEntendido } = require("./faqs");
const { registrarMensaje, registrarContacto, getContactosConocidos } = require("./db");
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
// WhatsApp rechaza (ack error 479) los estados armados como los arma Baileys por defecto
// en cuentas migradas a LID. Baileys lo esconde y sendMessage "funciona" igual.
// Por eso: armamos el estado a mano, esperamos el ACK real del servidor y, si lo rechaza,
// probamos variantes de formato una tras otra hasta que alguna sea aceptada.
// Una variante rechazada NO publica nada, así que no hay estados duplicados.
// Cuando una funciona, queda recordada y se loguea su nombre (podés fijarla con STATUS_VARIANTE).
const crypto = require("crypto");
const META_STATUS = [{ tag: "meta", attrs: { status_setting: "contacts" } }];
const VARIANTES_ESTADO = [
  { nombre: "lid-sinattr",      lid: true,  attr: null },
  { nombre: "lid-meta",         lid: true,  attr: null,  meta: true },
  { nombre: "lid-attrlid-meta", lid: true,  attr: "lid", meta: true },
  { nombre: "pn-sinattr",       lid: false, attr: null },
  { nombre: "pn-meta",          lid: false, attr: null,  meta: true },
  { nombre: "pn-attrpn",        lid: false, attr: "pn" },
  { nombre: "lid-attrlid",      lid: true,  attr: "lid" },
  // Diagnóstico: solo al propio bot. Si esta funciona y las otras no, el problema son los destinatarios.
  { nombre: "solo-propio-lid",  lid: true,  attr: null,  soloPropio: true },
];
let varianteOk = process.env.STATUS_VARIANTE || null;

function esperarAckEstado(sock, id, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const fin = (r) => { clearTimeout(t); sock.ws.off("CB:ack,class:message", onAck); resolve(r); };
    const onAck = (node) => {
      if (node?.attrs?.id !== id) return;
      fin(node.attrs.error ? { ok: false, error: node.attrs.error } : { ok: true });
    };
    const t = setTimeout(() => fin({ ok: false, error: "timeout (sin ack)" }), timeoutMs);
    sock.ws.on("CB:ack,class:message", onAck);
  });
}

async function armarDestinatariosEstado(sock, { lid, soloPropio }) {
  const sinDevice = (j) => (j || "").replace(/:\d+(?=@)/, "");
  const crudos = new Set();
  const creds = sock.authState?.creds;
  const propioPN  = sinDevice(creds?.me?.id || sock.user?.id);
  const propioLID = sinDevice(creds?.me?.lid || sock.user?.lid);
  if (propioPN)  crudos.add(propioPN);
  if (propioLID) crudos.add(propioLID);
  if (!soloPropio) {
    if (PHONE_NUMBER) crudos.add(`${PHONE_NUMBER}@s.whatsapp.net`);
    for (const n of (process.env.STATUS_DESTINATARIOS || "").split(",")) {
      const num = n.trim().replace(/\D/g, "");
      if (num) crudos.add(`${num}@s.whatsapp.net`);
    }
    for (const jid of getContactosConocidos()) crudos.add(sinDevice(jid));
  }

  const map = sock.signalRepository?.lidMapping;
  const final = new Map(); // user -> jid (dedupe por usuario)
  let omitidos = 0;
  for (const jid of crudos) {
    const esLid = jid.endsWith("@lid");
    if (!esLid && !jid.endsWith("@s.whatsapp.net")) continue;
    let destino = jid;
    try {
      if (lid && !esLid)      destino = sinDevice(await map.getLIDForPN(jid));
      else if (!lid && esLid) destino = sinDevice(await map.getPNForLID(jid));
    } catch { destino = null; }
    if (!destino) { omitidos++; continue; }
    final.set(destino.split("@")[0], destino);
  }
  if (omitidos) logger.warn(`📢 [Estados] ${omitidos} contacto(s) sin equivalencia ${lid ? "LID" : "teléfono"}, omitidos.`);
  return [...final.values()];
}

async function manejarMensajeEstado(sock, msg) {
  const imagen = msg.message?.imageMessage;
  const video  = msg.message?.videoMessage;

  if (!imagen && !video) return;

  const tipo    = imagen ? "imagen" : "video";
  const caption = imagen?.caption || video?.caption || "";

  try {
    logger.info(`📢 [Estados] Procesando ${tipo}...`);
    const buffer = await downloadMediaMessage(msg, "buffer", {});
    const contenido = imagen ? { image: buffer, caption } : { video: buffer, caption, gifPlayback: false };
    const fullMsg = await generateWAMessage("status@broadcast", contenido, {
      logger: pino({ level: "silent" }),
      userJid: sock.user.id,
      upload: sock.waUploadToServer,
    });

    // Primero la variante que ya funcionó (o la fijada por env); después el resto.
    const orden = [...VARIANTES_ESTADO].sort((x, y) => (y.nombre === varianteOk) - (x.nombre === varianteOk));
    const errores = [];
    let publicado = null, nDest = 0;

    for (const v of orden) {
      if (process.env.STATUS_VARIANTE && v.nombre !== process.env.STATUS_VARIANTE) continue;
      const statusJidList = await armarDestinatariosEstado(sock, v);
      const id = "3EB0" + crypto.randomBytes(9).toString("hex").toUpperCase();
      logger.info(`📢 [Estados] Probando variante "${v.nombre}" → ${statusJidList.length} destinatario(s): ${statusJidList.join(", ")}`);
      const ackPromesa = esperarAckEstado(sock, id);
      try {
        await sock.relayMessage("status@broadcast", fullMsg.message, {
          messageId: id,
          statusJidList,
          additionalAttributes: v.attr ? { addressing_mode: v.attr } : {},
          additionalNodes: v.meta ? META_STATUS : undefined,
        });
      } catch (e) {
        errores.push(`${v.nombre}: ${e.message}`);
        logger.warn(`📢 [Estados] Variante "${v.nombre}" falló al enviar: ${e.message}`);
        continue;
      }
      const ack = await ackPromesa;
      if (ack.ok) { publicado = v; nDest = statusJidList.length; break; }
      errores.push(`${v.nombre}: ${ack.error}`);
      logger.warn(`📢 [Estados] Variante "${v.nombre}" rechazada por el servidor (error ${ack.error}).`);
    }

    if (!publicado) throw new Error(`todas las variantes fueron rechazadas → ${errores.join(" | ")}`);

    varianteOk = publicado.nombre;
    logger.info(`📢 [Estados] ✅ ACEPTADO con la variante "${publicado.nombre}" (${nDest} destinatarios, ${tipo}). Fijala con STATUS_VARIANTE=${publicado.nombre}`);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } });
  } catch (err) {
    logger.error(`📢 [Estados] Error: ${err.message}`);
    await sock.sendMessage(msg.key.remoteJid, { react: { text: "❌", key: msg.key } }).catch(() => {});
  }
}

// El panel web solo debe iniciarse una vez, no en cada reconexión de WhatsApp
let panelIniciado = false;
let checkConexionInterval = null;

async function iniciarBot(intentosReconexion = 0) {
  // Guarda la sesión en la carpeta ./auth para no tener que escanear
  // el QR cada vez que reinicies el bot.
  await cargarBaileys();
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  // Suprimir el ruido de "Closing session: SessionEntry" que imprime Baileys
  const consoleLogOriginal = console.log;
  console.log = (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("Closing session")) return;
    consoleLogOriginal(...args);
  };

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

  // ── Contactos: guardar JIDs para estados ─────────────────────
  // Baileys emite contacts.upsert al conectar y cuando llegan nuevos contactos.
  // Guardamos tanto @s.whatsapp.net como @lid (multi-device); excluimos grupos/broadcast.
  sock.ev.on("contacts.upsert", (contacts) => {
    let guardados = 0;
    for (const contact of contacts) {
      if (contact.id && !contact.id.endsWith("@g.us") && !contact.id.endsWith("@broadcast")) {
        registrarContacto(contact.id);
        guardados++;
      }
      // Si el contacto trae su número real (contact.jid), guardarlo: es el que sirve para estados
      if (contact.jid && contact.jid.endsWith("@s.whatsapp.net")) {
        registrarContacto(contact.jid);
      }
    }
    if (guardados > 0) logger.info(`📇 [Contactos] ${guardados} contacto(s) sincronizado(s) en DB.`);
  });

  // ── Escucha de mensajes entrantes ────────────────────────────
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    // Ignorar estados de contactos (status@broadcast) para no responderlos
    if (msg.key.remoteJid === "status@broadcast") return;

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

    // Registrar el JID en la DB para poder usarlo como destinatario de estados
    registrarContacto(remitente);
    // Si el chat viene como @lid, WhatsApp manda el número real en key.senderPn:
    // lo guardamos porque los estados solo se pueden dirigir a números de teléfono.
    if (msg.key.senderPn && msg.key.senderPn.endsWith("@s.whatsapp.net")) {
      registrarContacto(msg.key.senderPn);
    }

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

