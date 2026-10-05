// ============================================================
// BASE DE PREGUNTAS FRECUENTES DEL MUNICIPIO
// ============================================================

// ── Submenús (el usuario elige con 1, 2, 3...) ────────────────
const submenus = {
  tramites: {
    texto:
      "📄 *Trámites disponibles*\n\n" +
      "1. Camión atmosférico\n" +
      "2. Licencia de conducir\n\n" +
      "Escribí el número del trámite que necesitás, o *menú* para volver al inicio.",
    opciones: {
      "1": {
        respuesta:
          "🚛 *Camión atmosférico*\nSolicitá el camión atmosférico con este formulario:\nhttps://docs.google.com/forms/d/e/1FAIpQLSd4O0b_DSpWh2R40sjooIvErK437LNM2utHw_jMuj6HFHFqKw/viewform",
      },
      "2": {
        respuesta: {
          tipo: "documento",
          texto: "🚗 *Licencia de conducir*\nEn este documento vas a encontrar todos los requisitos para la licencia 👇",
          archivo: "licencia-conducir.pdf",
          nombre: "Requisitos licencia de conducir.pdf",
        },
      },
    },
  },
  turismo: {
    texto:
      "🏞️ *Turismo*\nValle Viejo tiene lugares hermosos para conocer 😍\n\n" +
      "1. Hostería Cuesta del Portezuelo\n" +
      "2. Cine Teatro Valle Viejo\n" +
      "3. El Portal\n" +
      "4. Paseo de los Artesanos\n\n" +
      "Escribí el número del lugar que querés conocer, o *menú* para volver al inicio.",
    opciones: {
      "1": {
        respuesta:
          "🏔️ *Hostería Cuesta del Portezuelo*\n" +
          "Ubicada en la cima de la tradicional Cuesta del Portezuelo, sobre la Ruta Provincial N° 42, en Valle Viejo.\n\n" +
          "*Información general*\n" +
          "• Contacto y reservas: Teléfono / WhatsApp +54 383 434-5564 (reservas obligatorias por WhatsApp).\n" +
          "• Instagram: https://www.instagram.com/hosteriacuestaelportezuelo/\n\n" +
          "*Servicios e instalaciones*\n" +
          "• Alojamiento: 8 habitaciones dobles con aire acondicionado frío/calor, Wi-Fi, Smart TV, agua caliente y desayuno incluido.\n" +
          "• Gastronomía: restaurante y cafetería abiertos todos los días (desayunos, almuerzos, meriendas buffet y cenas) con vistas panorámicas.\n\n" +
          "*Actividades y experiencias*\n" +
          "• Avistaje de cóndores\n" +
          "• Trekking y senderismo (tramos de 13 km aprox.)\n" +
          "• Eventos especiales: Wine Sunsets, ceremonias de Corpachada/Pachamama y competencias de trail.",
      },
      "2": {
        respuesta:
          "🎭 *Cine Teatro Valle Viejo*\n" +
          "Ubicado frente a la tradicional Plaza del Aborigen.\n\n" +
          "*Información general*\n" +
          "• WhatsApp: +54 383 512-6036\n" +
          "• Sitio web: https://cine.valleviejo.gob.ar/\n" +
          "• Instagram: https://www.instagram.com/cineteatrovalleviejo/\n\n" +
          "*Servicios e instalaciones*\n" +
          "• Sala cerrada con capacidad para 214 butacas, con espacios reservados para personas con discapacidad (CUD) y baños adaptados.\n" +
          "• Escenario de doble apertura: espectáculos en el auditorio interior o al aire libre hacia la plaza.\n" +
          "• Pantalla de alta calidad con proyección 2D y 3D, y climatización frío/calor.\n\n" +
          "*Actividades y experiencias*\n" +
          "• Cine comercial e independiente: funciones habitualmente de jueves a domingos, con estrenos nacionales e internacionales.\n" +
          "• Espectáculos en vivo: teatro infantil y para adultos, comedias y shows musicales.\n" +
          "• Beneficios: promociones de 2x1 en días seleccionados y cupos gratuitos por función para personas con discapacidad.",
      },
      "3": {
        respuesta:
          "🛒 *El Portal*\n" +
          "Un mercado de compras integral, familiar y de precios mayoristas para consumidores minoristas.\n\n" +
          "• Dirección: Av. Presidente Castillo esquina Horacio Brunello (frente a Cotali)\n" +
          "• Horarios: todos los sábados de 09:00 a 18:00 hs.\n" +
          "• Rubros: carnicería, pollería, lácteos, pastas, frutas, verduras, bebidas, productos sin TACC y artículos de limpieza.\n" +
          "• Instagram: https://www.instagram.com/portalvalleviejo/",
      },
      "4": {
        respuesta:
          "🎨 *Paseo de los Artesanos*\n" +
          "Ubicado en la Plaza El Aborigen.\n\n" +
          "• Días y horarios: sábados y domingos por la tarde.\n\n" +
          "*Servicios e instalaciones*\n" +
          "• 24 stands fijos semicubiertos para los feriantes.\n" +
          "• Integrado a la plaza con juegos infantiles, bancos y accesibilidad.\n" +
          "• Rodeado de puestos con comidas rápidas y dulces regionales.\n\n" +
          "*Actividades y experiencias*\n" +
          "• Feria: venta directa de tejidos, cerámica, marroquinería y artesanías locales.\n" +
          "• Eventos: shows folclóricos en vivo, danzas y celebraciones comunitarias.",
      },
    },
  },
};

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
    // Abre el submenú de trámites
    palabras_clave: ["tramite", "tramites", "documentacion", "requisitos", "papeles", "3"],
    respuesta: { tipo: "submenu", id: "tramites", texto: submenus.tramites.texto },
  },
  {
    palabras_clave: ["camion atmosferico", "atmosferico"],
    respuesta: submenus.tramites.opciones["1"].respuesta,
  },
  {
    palabras_clave: ["licencia", "carnet", "registro de conducir"],
    respuesta: submenus.tramites.opciones["2"].respuesta,
  },
  {
    palabras_clave: ["reclamo", "reclamos", "denuncia", "queja", "bache", "baches", "alumbrado", "luz", "basura", "residuos", "arbol", "rama", "calle", "4"],
    respuesta:
      "📢 *Reclamos*\nCargá tu reclamo (alumbrado, limpieza, baches, etc.) completando este formulario:\nhttps://docs.google.com/forms/d/e/1FAIpQLSf01unpuwhlhJeduWUKxz1hdW2sOpPTcHbkkPbfg9yRkgb8kQ/viewform",
  },
  {
    palabras_clave: ["casa de la juventud", "juventud", "jovenes", "5"],
    respuesta:
      "🏠 *Casa de la Juventud*\n" +
      "Es un espacio municipal de encuentro, capacitación y contención destinado a los jóvenes del departamento, ubicado en Padre Esquiú 194, San Isidro, Catamarca.\n\n" +
      "*Información general*\n" +
      "• Horarios de atención: lunes a viernes de 06:00 a 21:00 hs.\n" +
      "• Teléfono / consultas: 3834 91-9763\n" +
      "• Redes sociales: @soyjovenvalleviejo\n\n" +
      "*Actividades y servicios*\n" +
      "• Talleres gratuitos: propuestas recreativas, culturales y de formación (como ritmos urbanos y actividades comunitarias).\n" +
      "• Programa \"Cuenta Conmigo\": dispositivo de escucha y acompañamiento en salud mental, gratuito, anónimo y confidencial.",
  },
  {
    palabras_clave: ["conviviendo", "programa conviviendo", "discapacidad", "6"],
    respuesta:
      "🤝 *Conviviendo*\n" +
      "Es un espacio municipal de igualdad, inclusión y aprendizaje destinado a personas con discapacidad en Valle Viejo.\n\n" +
      "*Información general*\n" +
      "• Dirección: Hignio Rizo 136, Villa Dolores (frente a la Plaza Ramón S. Castillo).\n" +
      "• Horarios de atención: lunes a viernes de 08:00 a 13:00 y de 15:00 a 20:00.\n" +
      "• Actividades: talleres de sensibilización, capacitación laboral, inclusión educativa y propuestas recreativas o de reflexión comunitaria.",
  },
  {
    palabras_clave: ["medio ambiente", "ambiente", "ecologia", "reciclaje", "poda", "quema", "agua servida", "7"],
    respuesta:
      "🌿 *DIRECCIÓN DE MEDIO AMBIENTE*\n" +
      "Ponemos a tu disposición nuestro número de WhatsApp para recibir:\n\n" +
      "🚨 *RECLAMOS Y DENUNCIAS*\n" +
      "• Podas ✂️\n" +
      "• Agua servida 💧\n" +
      "• Quemas 🔥\n" +
      "• Y otros delitos ambientales 🍃\n\n" +
      "📲 Escribinos al: 3834402116\n\n" +
      "🕒 *Horario de atención:*\n" +
      "• Mañana: 7:00 a 13:00 hs\n" +
      "• Tarde: 14:00 a 20:00 hs",
  },
  {
    // Abre el submenú de turismo
    palabras_clave: ["turismo", "visitar", "pasear", "lugares", "8"],
    respuesta: { tipo: "submenu", id: "turismo", texto: submenus.turismo.texto },
  },
  {
    palabras_clave: ["posta", "postas", "postas sanitarias", "salud", "caps", "9"],
    respuesta: {
      tipo: "imagen",
      texto: "🏥 *Postas Sanitarias*\n¡Te comparto un documento con todas las postas sanitarias y su información! 👇",
      archivo: "postas-sanitarias.jpg",
    },
  },
  {
    palabras_clave: ["deporte", "deportes", "polideportivo", "canchas", "10"],
    respuesta:
      "⚽ *Deporte*\nSeguí todas las novedades sobre el deporte en Valle Viejo en su Instagram oficial:\nhttps://www.instagram.com/deporte.valleviejo/",
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
    "1. Horarios de atención\n" +
    "2. Ubicación\n" +
    "3. Trámites\n" +
    "4. Reclamos\n" +
    "5. Casa de la Juventud\n" +
    "6. Conviviendo\n" +
    "7. Medio Ambiente\n" +
    "8. Turismo\n" +
    "9. Postas Sanitarias\n" +
    "10. Deporte"
};

// Mensaje cuando no se entiende la consulta
const noEntendido =
  "🤔 No tengo una respuesta para eso todavía.\n\n" +
  "Escribí *menú* para ver todas las opciones disponibles.";

module.exports = { faqs, submenus, bienvenida, noEntendido };
