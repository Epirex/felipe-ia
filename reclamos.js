// ============================================================
// MÓDULO DE RECLAMOS — conversación guiada paso a paso
// Al elegir "reclamos" el ciudadano puede:
//   1) Hacer un reclamo: nombre, DNI, domicilio, categoría y detalle.
//      Se guarda en la tabla "reclamos" y se le informa su número.
//   2) Consultar el estado de un reclamo: número + DNI (verificación).
// El estado de la conversación vive en memoria (expira a los 10 min).
// ============================================================

const { guardarReclamo, getReclamoPorNumero } = require("./db");

const RECLAMO_TTL_MS = 10 * 60 * 1000;
const conversaciones = new Map(); // jid → { paso, datos, ts }

// Anti-fuerza-bruta en las consultas: tras MAX_FALLOS_CONSULTA fallos se bloquea al número un rato
const MAX_FALLOS_CONSULTA = 5;
const BLOQUEO_CONSULTA_MS = 15 * 60 * 1000;
const fallosConsulta = new Map(); // jid → { n, hasta }

const CATEGORIAS = [
  "Cloacas",
  "Bacheo",
  "Tránsito",
  "Salud",
  "Recolección",
  "Desmalezamiento",
  "Desarrollo social",
  "Obra pública",
  "Alumbrado público",
  "Otro",
];

const PREGUNTA_CATEGORIA =
  "¿Qué *categoría* tiene tu reclamo? Respondeme con el *número*:\n\n" +
  CATEGORIAS.map((c, i) => `${i + 1}. ${c}`).join("\n");

const PREGUNTAS = {
  nombre:    "¿Me brindás tu *nombre completo*?",
  dni:       "¿Cuál es tu *DNI*? (sin puntos ni espacios)",
  domicilio: "¿Cuál es tu *domicilio o el lugar del problema*?",
  categoria: PREGUNTA_CATEGORIA,
  detalle:
    "¿Podés comentarme *detalladamente tu reclamo en un solo mensaje*? Es importante que expliques todo en un solo mensaje así puedo guardar esa información completa en nuestro sistema 📝",
  consultaNumero: "¿Cuál es el *número de tu reclamo*? (es el que te di cuando lo cargaste)",
  consultaDni:    "Para verificar que sos vos, ¿cuál es el *DNI* con el que cargaste el reclamo? (sin puntos ni espacios)",
};

// Primer mensaje al elegir "Reclamos": ¿hacer uno nuevo o consultar?
const MENSAJE_INICIO =
  "📢 *Reclamos*\n¿Qué querés hacer? Respondeme con el *número*:\n\n" +
  "1. Hacer un reclamo\n" +
  "2. Consultar el estado de un reclamo\n\n" +
  "(Si querés cancelar en cualquier momento, escribí *cancelar*.)";

const MENSAJE_ALTA =
  "¡Estoy acá para ayudarte! 🙌 Te voy a hacer unas preguntas cortas para registrar tu reclamo.\n\n" +
  PREGUNTAS.nombre;

const PALABRAS_CANCELAR = ["cancelar", "cancelo", "salir", "menu", "volver", "regresar", "atras"];

function normalizar(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function iniciarReclamo(jid) {
  conversaciones.set(jid, { paso: "opcion", datos: {}, ts: Date.now() });
}

function reclamoActivo(jid) {
  const c = conversaciones.get(jid);
  if (!c) return false;
  if (Date.now() - c.ts > RECLAMO_TTL_MS) {
    conversaciones.delete(jid);
    return false;
  }
  return true;
}

function cancelarReclamo(jid) {
  conversaciones.delete(jid);
}

function esCancelacion(texto) {
  const palabras = normalizar(texto).split(/[^a-z0-9ñ]+/);
  return palabras.some((p) => PALABRAS_CANCELAR.includes(p));
}

function bloqueado(jid) {
  const f = fallosConsulta.get(jid);
  if (!f) return false;
  if (f.hasta && Date.now() < f.hasta) return true;
  if (f.hasta && Date.now() >= f.hasta) fallosConsulta.delete(jid);
  return false;
}

function registrarFalloConsulta(jid) {
  const f = fallosConsulta.get(jid) || { n: 0, hasta: 0 };
  f.n++;
  if (f.n >= MAX_FALLOS_CONSULTA) f.hasta = Date.now() + BLOQUEO_CONSULTA_MS;
  fallosConsulta.set(jid, f);
  // Limpieza para no acumular memoria
  if (fallosConsulta.size > 500) {
    for (const [k, v] of fallosConsulta) if (v.hasta && Date.now() >= v.hasta) fallosConsulta.delete(k);
  }
}

const ICONO_ESTADO = { "Pendiente": "🕓", "En curso": "🛠️", "Resuelto": "✅", "Rechazado": "❌" };

function textoEstado(r) {
  let t =
    `📄 *Reclamo N° ${r.numero}*\n` +
    `Categoría: ${r.categoria}\n` +
    `Fecha de carga: ${r.fecha}\n` +
    `Estado: ${ICONO_ESTADO[r.estado] || "ℹ️"} *${r.estado}*`;
  if (r.respuesta) t += `\n\n💬 *Respuesta del área:*\n${r.respuesta}`;
  return t;
}

// Procesa la respuesta del ciudadano. Devuelve { mensaje, terminado, tipo }.
//   tipo: "alta" (reclamo registrado) | "consulta" (consulta resuelta) | undefined (sigue la charla)
// `telefono` es el número (o ID de WhatsApp) para contactarlo si hace falta.
function procesarReclamo(jid, texto, telefono, { viaAudio = false } = {}) {
  const c = conversaciones.get(jid);
  const valor = String(texto).trim();
  const norm = normalizar(valor);
  c.ts = Date.now();

  switch (c.paso) {
    case "opcion": {
      const palabras = norm.split(/[^a-z0-9ñ]+/);
      // "consultar/estado/seguimiento" se revisa primero: "consultar mi reclamo" también contiene "reclamo"
      const quiereConsulta = norm === "2" || /consult|estado|seguimiento|como (va|esta)|numero/.test(norm);
      const quiereAlta = norm === "1" || /hacer|nuevo|cargar|realizar|iniciar|quiero reclamar|denunciar/.test(norm) || palabras.includes("reclamar");
      if (quiereConsulta) {
        if (bloqueado(jid)) {
          conversaciones.delete(jid);
          return { mensaje: "⛔ Hiciste demasiados intentos fallidos de consulta. Probá de nuevo en unos minutos o llamá al 03834443303.", terminado: true, tipo: "consulta" };
        }
        c.paso = "consulta_numero";
        return { mensaje: PREGUNTAS.consultaNumero, terminado: false };
      }
      if (quiereAlta) {
        c.paso = "nombre";
        return { mensaje: MENSAJE_ALTA, terminado: false };
      }
      return { mensaje: "No te entendí 🤔 Respondeme *1* para hacer un reclamo o *2* para consultar el estado de uno.", terminado: false };
    }

    case "consulta_numero": {
      const num = valor.replace(/[^0-9]/g, "");
      if (!num || num.length > 9) {
        return { mensaje: "Necesito el número de reclamo (solo números). " + PREGUNTAS.consultaNumero, terminado: false };
      }
      c.datos.numero = Number(num);
      c.paso = "consulta_dni";
      return { mensaje: PREGUNTAS.consultaDni, terminado: false };
    }

    case "consulta_dni": {
      if (bloqueado(jid)) {
        conversaciones.delete(jid);
        return { mensaje: "⛔ Hiciste demasiados intentos fallidos de consulta. Probá de nuevo en unos minutos o llamá al 03834443303.", terminado: true, tipo: "consulta" };
      }
      const dni = valor.replace(/[.\s-]/g, "");
      const r = /^\d{7,8}$/.test(dni) ? getReclamoPorNumero(c.datos.numero) : null;
      conversaciones.delete(jid);
      // Mismo mensaje si el número no existe o el DNI no coincide (no revelar qué reclamos existen)
      if (!r || String(r.dni) !== dni) {
        registrarFalloConsulta(jid);
        return {
          mensaje: "No encontré ningún reclamo con esos datos 😕 Revisá el número y el DNI e intentá de nuevo escribiendo *4*.",
          terminado: true,
          tipo: "consulta",
        };
      }
      fallosConsulta.delete(jid);
      return { mensaje: textoEstado(r), terminado: true, tipo: "consulta" };
    }

    case "nombre":
      if (valor.length < 3 || valor.length > 100 || /^\d+$/.test(valor)) {
        return { mensaje: "Necesito tu nombre y apellido para registrar el reclamo. " + PREGUNTAS.nombre, terminado: false };
      }
      c.datos.nombre = valor;
      c.paso = "dni";
      return { mensaje: PREGUNTAS.dni, terminado: false };

    case "dni": {
      const dni = valor.replace(/[.\s-]/g, "");
      if (!/^\d{7,8}$/.test(dni)) {
        return { mensaje: "El DNI debe tener 7 u 8 números, sin letras. " + PREGUNTAS.dni, terminado: false };
      }
      c.datos.dni = dni;
      c.paso = "domicilio";
      return { mensaje: PREGUNTAS.domicilio, terminado: false };
    }

    case "domicilio":
      if (valor.length < 3 || valor.length > 200) {
        return { mensaje: "Necesito saber dónde es el problema. " + PREGUNTAS.domicilio, terminado: false };
      }
      c.datos.domicilio = valor;
      c.paso = "categoria";
      return { mensaje: PREGUNTAS.categoria, terminado: false };

    case "categoria": {
      // Acepta el número (1-10) o el nombre de la categoría (también por audio)
      const n = norm.replace(/[^a-z0-9ñ ]/g, "").trim();
      let categoria = null;
      if (/^\d+$/.test(n)) {
        categoria = CATEGORIAS[Number(n) - 1] || null;
      } else if (n.length >= 3) {
        categoria = CATEGORIAS.find((cat) => {
          const nc = normalizar(cat);
          return n === nc || n.includes(nc);
        }) || null;
      }
      if (!categoria) {
        return { mensaje: "No reconocí esa opción 🤔 Elegí un número del 1 al " + CATEGORIAS.length + ".\n\n" + PREGUNTAS.categoria, terminado: false };
      }
      c.datos.categoria = categoria;
      c.paso = "detalle";
      return { mensaje: `Anotado: *${categoria}* ✅\n\n` + PREGUNTAS.detalle, terminado: false };
    }

    case "detalle": {
      if (valor.length < 10) {
        return { mensaje: "Necesito un poco más de detalle para poder derivarlo bien. " + PREGUNTAS.detalle, terminado: false };
      }
      const numero = guardarReclamo({
        nombre: c.datos.nombre,
        dni: c.datos.dni,
        domicilio: c.datos.domicilio,
        categoria: c.datos.categoria,
        detalle: valor.slice(0, 2000),
        telefono,
        viaAudio,
      });
      conversaciones.delete(jid);
      return {
        mensaje:
          `✅ ¡Gracias por cooperar! Tu reclamo fue registrado con éxito. *Tu número de reclamo es el ${numero}* 🔖\n\n` +
          "Guardalo: más adelante podés escribirme *4* y elegir *consultar el estado* para saber cómo va (te voy a pedir este número y tu DNI).\n\n" +
          "Ahora mismo lo derivo al área correspondiente. ¡Que tengas un excelente día! 😊",
        terminado: true,
        tipo: "alta",
      };
    }
  }
}

module.exports = {
  CATEGORIAS,
  MENSAJE_INICIO,
  iniciarReclamo,
  reclamoActivo,
  cancelarReclamo,
  esCancelacion,
  procesarReclamo,
};
