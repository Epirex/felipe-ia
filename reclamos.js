// ============================================================
// MÓDULO DE RECLAMOS — conversación guiada paso a paso
// Recolecta: nombre completo, DNI, domicilio/lugar y detalle,
// y lo guarda en la tabla "reclamos" de la base de datos.
// El estado de la conversación vive en memoria (expira a los 10 min).
// ============================================================

const { guardarReclamo } = require("./db");

const RECLAMO_TTL_MS = 10 * 60 * 1000;
const conversaciones = new Map(); // jid → { paso, datos, ts }

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
  dni:       "¿Cuál es tu *DNI*?",
  domicilio: "¿Cuál es tu *domicilio o el lugar del problema*?",
  categoria: PREGUNTA_CATEGORIA,
  detalle:
    "¿Podés comentarme *detalladamente tu reclamo en un solo mensaje*? Es importante que expliques todo en un solo mensaje así puedo guardar esa información completa en nuestro sistema 📝",
};

const MENSAJE_INICIO =
  "📢 *Reclamos*\n¡Estoy acá para ayudarte! Te voy a hacer unas preguntas cortas para registrar tu reclamo.\n(Si querés cancelar en cualquier momento, escribí *cancelar*.)\n\n" +
  PREGUNTAS.nombre;

const MENSAJE_FINAL =
  "✅ ¡Gracias por cooperar! Tu reclamo fue registrado con éxito y ahora mismo lo derivo al área correspondiente. ¡Que tengas un excelente día! 😊";

const PALABRAS_CANCELAR = ["cancelar", "cancelo", "salir", "menu", "volver", "regresar", "atras"];

function normalizar(t) {
  return String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function iniciarReclamo(jid) {
  conversaciones.set(jid, { paso: "nombre", datos: {}, ts: Date.now() });
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

// Procesa la respuesta del ciudadano. Devuelve { mensaje, terminado }.
// `telefono` es el número (o ID de WhatsApp) para contactarlo si hace falta.
function procesarReclamo(jid, texto, telefono, { viaAudio = false } = {}) {
  const c = conversaciones.get(jid);
  const valor = String(texto).trim();
  c.ts = Date.now();

  switch (c.paso) {
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
      const norm = normalizar(valor).replace(/[^a-z0-9ñ ]/g, "").trim();
      let categoria = null;
      if (/^\d+$/.test(norm)) {
        categoria = CATEGORIAS[Number(norm) - 1] || null;
      } else if (norm.length >= 3) {
        categoria = CATEGORIAS.find((cat) => {
          const n = normalizar(cat);
          return norm === n || norm.includes(n);
        }) || null;
      }
      if (!categoria) {
        return { mensaje: "No reconocí esa opción 🤔 Elegí un número del 1 al " + CATEGORIAS.length + ".\n\n" + PREGUNTAS.categoria, terminado: false };
      }
      c.datos.categoria = categoria;
      c.paso = "detalle";
      return { mensaje: `Anotado: *${categoria}* ✅\n\n` + PREGUNTAS.detalle, terminado: false };
    }

    case "detalle":
      if (valor.length < 10) {
        return { mensaje: "Necesito un poco más de detalle para poder derivarlo bien. " + PREGUNTAS.detalle, terminado: false };
      }
      guardarReclamo({
        nombre: c.datos.nombre,
        dni: c.datos.dni,
        domicilio: c.datos.domicilio,
        categoria: c.datos.categoria,
        detalle: valor.slice(0, 2000),
        telefono,
        viaAudio,
      });
      conversaciones.delete(jid);
      return { mensaje: MENSAJE_FINAL, terminado: true };
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
