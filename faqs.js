// ============================================================
// BASE DE PREGUNTAS FRECUENTES DEL MUNICIPIO
// ============================================================

const faqs = [
  {
    palabras_clave: ["horario", "horarios", "atencion", "atienden", "abren", "cierran", "1"],
    respuesta:
      "🕐 *Horario de atención*\nLunes a viernes de 7:00 a 13:00 hs.\nSábados, domingos y feriados: cerrado.",
  },
  {
    // Respuesta especial: manda ubicación en el mapa + texto
    palabras_clave: ["direccion", "ubicacion", "donde queda", "donde esta", "domicilio", "como llego", "llegar", "2"],
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
    palabras_clave: ["turno", "turnos", "sacar turno", "reservar turno", "3"],
    respuesta:
      "📅 *Turnos*\n¿Qué turno necesitás sacar?\n\n🚗 *Licencia de conducir*: https://valleviejo.gob.ar/sitio_landing/licencias/\n\n🚛 *Camión atmosférico*: https://docs.google.com/forms/d/e/1FAIpQLSd4O0b_DSpWh2R40sjooIvErK437LNM2utHw_jMuj6HFHFqKw/viewform\n\n🤝 *Acción Social*: (⚠️ Falta completar link o info)",
  },
  {
    palabras_clave: ["tramite", "tramites", "documentacion", "requisitos", "papeles", "4"],
    respuesta:
      "📄 *Trámites*\nContanos qué trámite necesitás hacer y te paso los datos correspondientes. También podés consultar en nuestra web: https://valleviejo.gob.ar/",
  },
  {
    palabras_clave: ["reclamo", "reclamos", "denuncia", "queja", "bache", "baches", "alumbrado", "luz", "basura", "residuos", "arbol", "rama", "calle", "5"],
    respuesta:
      "📢 *Reclamos*\nCargá tu reclamo (alumbrado, limpieza, baches, etc.) completando este formulario:\nhttps://docs.google.com/forms/d/e/1FAIpQLSf01unpuwhlhJeduWUKxz1hdW2sOpPTcHbkkPbfg9yRkgb8kQ/viewform",
  },
  {
    palabras_clave: ["impuesto", "impuestos", "tasa", "tasas", "pagar", "rentas", "6"],
    respuesta:
      "💰 *Pagos e impuestos*\nPodés pagar tus tasas municipales online en:\nhttps://valleviejo.gob.ar/rentas/\n\nO en las cajas habilitadas de lunes a viernes de 7:00 a 13:00 hs.",
  },
  {
    palabras_clave: ["casa de la juventud", "juventud", "jovenes", "7"],
    respuesta:
      "🏠 *Casa de la Juventud*\n(⚠️ Falta completar información. Respondeme con los datos que querés que diga acá).",
  },
  {
    palabras_clave: ["conviviendo", "programa conviviendo", "8"],
    respuesta:
      "🤝 *Programa Conviviendo*\n(⚠️ Falta completar información. Respondeme con los datos que querés que diga acá).",
  },
  {
    palabras_clave: ["recoleccion", "basurero", "camion de basura", "recoleccion de residuos", "9"],
    respuesta:
      "🗑️ *Recolección de Residuos*\n(⚠️ Falta completar información sobre los días y horarios por barrio).",
  },
  {
    palabras_clave: ["medio ambiente", "ambiente", "ecologia", "reciclaje", "10"],
    respuesta:
      "🌱 *Medio Ambiente*\n(⚠️ Falta completar información. Respondeme con los datos que querés que diga acá).",
  },
  {
    palabras_clave: ["turismo", "visitar", "pasear", "lugares", "11"],
    respuesta:
      "🏞️ *Turismo*\nValle Viejo tiene hermosos lugares para conocer. (⚠️ Falta completar información sobre atractivos o links de turismo).",
  },
  {
    palabras_clave: ["posta", "postas", "postas sanitarias", "salud", "caps", "12"],
    respuesta:
      "🏥 *Postas Sanitarias*\n(⚠️ Falta completar información sobre ubicación y horarios de las postas).",
  },
  {
    palabras_clave: ["deporte", "deportes", "polideportivo", "canchas", "13"],
    respuesta:
      "⚽ *Deporte*\n(⚠️ Falta completar información sobre actividades deportivas).",
  },
  {
    palabras_clave: ["contacto", "telefono", "numero", "llamar", "email", "correo"],
    respuesta:
      "📞 *Contacto*\nTeléfono: 03834443303\nFacebook: https://www.facebook.com/municipiodevalleviejo/\nInstagram: https://www.instagram.com/valleviejociudad/",
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
const bienvenida = {
  tipo: "bienvenida",
  texto: 
    "👋 ¡Hola! Soy *Felipe IA*, el asistente virtual del *Municipio de Valle Viejo*.\n\n" +
    "¿En qué puedo ayudarte? Escribí el número de la opción deseada o tu consulta:\n\n" +
    "1️⃣ Horarios de atención\n" +
    "2️⃣ Ubicación\n" +
    "3️⃣ Turnos (Licencia, Atmosférico, Acción Social)\n" +
    "4️⃣ Trámites\n" +
    "5️⃣ Reclamos\n" +
    "6️⃣ Pagos e impuestos\n" +
    "7️⃣ Casa de la Juventud\n" +
    "8️⃣ Conviviendo\n" +
    "9️⃣ Recolección de residuos\n" +
    "🔟 Medio Ambiente\n" +
    "1️⃣1️⃣ Turismo\n" +
    "1️⃣2️⃣ Postas Sanitarias\n" +
    "1️⃣3️⃣ Deporte"
};

// Mensaje cuando no se entiende la consulta
const noEntendido =
  "🤔 No tengo una respuesta para eso todavía.\n\n" +
  "Escribí *menú* para ver todas las opciones disponibles.";

module.exports = { faqs, bienvenida, noEntendido };
