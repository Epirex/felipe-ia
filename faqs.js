// ============================================================
// BASE DE PREGUNTAS FRECUENTES DEL MUNICIPIO
// ============================================================
// Cada entrada tiene:
//   - palabras_clave: si alguna aparece en el mensaje, se usa esa respuesta.
//   - respuesta: puede ser un string (texto simple) o un objeto especial:
//       { tipo: "ubicacion", ... }   → manda pin de ubicación en el mapa
// El bot revisa las entradas en orden y usa la primera que matchee.
// ============================================================

// NOTA: las entradas de "quien sos" / "quien te hizo" y "como estas" a
// propósito NO figuran en el texto de "bienvenida". Siguen funcionando
// si alguien pregunta directamente, pero no se muestran en el menú.

const faqs = [
  {
    palabras_clave: ["horario", "horarios", "atencion", "atienden", "abren", "cierran", "6"],
    respuesta:
      "🕐 *Horario de atención*\nLunes a viernes de 7:00 a 13:00 hs.\nSábados, domingos y feriados: cerrado.",
  },
  {
    // Respuesta especial: manda ubicación en el mapa + texto
    palabras_clave: ["direccion", "ubicacion", "donde queda", "donde esta", "domicilio", "como llego", "llegar", "7"],
    respuesta: {
      tipo: "ubicacion",
      latitud: -28.44927,
      longitud: -65.72571,
      nombre: "Municipalidad de Valle Viejo",
      direccion: "Av. Presidente Castillo 441, Valle Viejo, Catamarca",
      texto: "📍 *Ubicación*\nAv. Presidente Castillo 441, Valle Viejo, Catamarca.\n\nTe comparto el pin en el mapa 👇",
    },
  },
  {
    palabras_clave: ["turno", "turnos", "sacar turno", "reservar turno"],
    respuesta:
      "📅 *Turnos*\n¿Qué turno necesitás sacar?\n1️⃣ Licencia de conducir\n2️⃣ Camión atmosférico (desagote/pozo ciego)\n\nRespondé con el número o el nombre del trámite y te paso el link correspondiente.",
  },
  {
    palabras_clave: ["contacto", "telefono", "numero", "llamar", "email", "correo", "8"],
    respuesta:
      "📞 *Contacto*\nTeléfono: 03834443303\nFacebook: https://www.facebook.com/municipiodevalleviejo/\nInstagram: https://www.instagram.com/valleviejociudad/",
  },
  {
    palabras_clave: ["tramite", "tramites", "documentacion", "requisitos", "papeles", "3"],
    respuesta:
      "📄 *Trámites*\nContanos qué trámite necesitás hacer (ej: licencia de conducir, camión atmosférico, reclamos, pago de tasas) y te paso los datos correspondientes.",
  },
  {
    palabras_clave: ["licencia", "licencia de conducir", "carnet", "turno licencia", "1"],
    respuesta:
      "🚗 *Licencia de conducir*\nTodos los requisitos y el turno online los encontrás acá:\nhttps://valleviejo.gob.ar/sitio_landing/licencias/",
  },
  {
    palabras_clave: ["camion atmosferico", "atmosferico", "desagote", "pozo ciego", "turno camion", "2"],
    respuesta:
      "🚛 *Turno para camión atmosférico*\nSolicitá tu turno completando este formulario:\nhttps://docs.google.com/forms/d/e/1FAIpQLSd4O0b_DSpWh2R40sjooIvErK437LNM2utHw_jMuj6HFHFqKw/viewform",
  },
  {
    palabras_clave: ["reclamo", "reclamos", "denuncia", "queja", "bache", "baches", "alumbrado", "luz", "basura", "residuos", "arbol", "rama", "calle", "4"],
    respuesta:
      "📢 *Reclamos*\nCargá tu reclamo (alumbrado, recolección de residuos, baches, etc.) completando este formulario:\nhttps://docs.google.com/forms/d/e/1FAIpQLSf01unpuwhlhJeduWUKxz1hdW2sOpPTcHbkkPbfg9yRkgb8kQ/viewform",
  },
  {
    palabras_clave: ["impuesto", "impuestos", "tasa", "tasas", "pagar", "rentas", "5"],
    respuesta:
      "💰 *Pagos e impuestos*\nPodés pagar tus tasas municipales online en:\nhttps://valleviejo.gob.ar/rentas/\n\nO en las cajas habilitadas de lunes a viernes de 7:00 a 13:00 hs.",
  },
  // ---- Estas NO aparecen en el menú, solo responden si preguntan directo ----
  {
    palabras_clave: ["quien sos", "quien eres", "como te llamas", "tu nombre", "eres un bot", "sos un bot"],
    respuesta:
      "🤖 Soy *Felipe IA*, un chatbot inspirado en Felipe Varela. Estoy diseñado para ayudarte en todo lo que necesites sobre el Municipio de Valle Viejo.",
  },
  {
    palabras_clave: ["quien te hizo", "quien te creo", "quien te programo", "quien te desarrollo"],
    respuesta:
      "👨‍💻 Fui creado por Esteban Guzzo en la Oficina de Modernización de la Municipalidad de Valle Viejo.",
  },
  {
    palabras_clave: ["como estas", "como andas", "que tal", "todo bien", "como va"],
    respuesta:
      "😊 ¡Todo bien por acá, gracias por preguntar! Listo para ayudarte con lo que necesites del municipio.",
  },
];

// ── Menú de bienvenida ────────────────────────────────────────
// Texto numerado: funciona en cualquier versión de WhatsApp.
const bienvenida = {
  tipo: "bienvenida",
  texto: 
    "👋 ¡Hola! Soy *Felipe IA*, el asistente virtual del *Municipio de Valle Viejo*.\n\n" +
    "¿En qué puedo ayudarte? Escribí el número o tu consulta con tus propias palabras:\n\n" +
    "*Trámites y servicios*\n" +
    "1️⃣  Licencia de conducir\n" +
    "2️⃣  Camión atmosférico\n" +
    "3️⃣  Trámites municipales\n" +
    "4️⃣  Reclamos (baches, alumbrado, etc.)\n" +
    "5️⃣  Pagos e impuestos\n\n" +
    "*Información general*\n" +
    "6️⃣  Horarios de atención\n" +
    "7️⃣  Ubicación\n" +
    "8️⃣  Contacto"
};

// Mensaje cuando no se entiende la consulta
const noEntendido =
  "🤔 No tengo una respuesta para eso todavía.\n" +
  "Probá preguntando por: *horarios*, *dirección*, *contacto*, *trámites*, *reclamo* o *pagos*.\n\n" +
  "O escribí *menú* para ver todas las opciones.";

module.exports = { faqs, bienvenida, noEntendido };
