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

// ── Pines de ubicación de cada lugar turístico ────────────────
// Coordenadas aproximadas (mapcarta/wikimapia). Cine Teatro y Paseo de los
// Artesanos comparten la Plaza El Aborigen. Ajustar si hace falta más precisión.
const pinesTurismo = {
  "1": { latitud: -28.48936, longitud: -65.60629, nombre: "Hostería Cuesta del Portezuelo", direccion: "Ruta Provincial N° 42, Cuesta del Portezuelo, Valle Viejo" },
  "2": { latitud: -28.449,   longitud: -65.721,   nombre: "Cine Teatro Valle Viejo",         direccion: "Frente a la Plaza El Aborigen, Valle Viejo" },
  "3": { latitud: -28.43551, longitud: -65.71119, nombre: "El Portal",                       direccion: "Av. Presidente Castillo esq. Horacio Brunello, Valle Viejo" },
  "4": { latitud: -28.449,   longitud: -65.721,   nombre: "Paseo de los Artesanos",          direccion: "Plaza El Aborigen, Valle Viejo" },
};
for (const [k, pin] of Object.entries(pinesTurismo)) {
  const op = submenus.turismo.opciones[k];
  op.respuesta = {
    tipo: "ubicacion",
    texto: op.respuesta + "\n\n📍 Te comparto la ubicación 👇\n\nEscribí otro número para ver otro lugar, o *volver* para ir al menú.",
    ...pin,
  };
}

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
      "🤖 Soy *Felipe IA*, un asistente virtual inspirado en Felipe Varela. Estoy diseñado para ayudarte en todo lo que necesites sobre el Municipio de Valle Viejo.",
  },
  {
    palabras_clave: ["quien te hizo", "quien te creo", "quien te programo", "quien te desarrollo"],
    respuesta:
      "👨‍💻 Fui creado por Esteban Guzzo en la Direccion de Informatica de la Municipalidad de Valle Viejo.",
  },
  {
    palabras_clave: ["como estas", "como andas", "que tal", "todo bien", "como va"],
    respuesta:
      "😊 ¡Todo bien por acá, gracias por preguntar! Listo para ayudarte con lo que necesites del municipio.",
  },
];

// ── Charla casual ─────────────────────────────────────────────
// Se consulta solo si ninguna FAQ coincidió. Coincide por palabra/frase completa
// (no por substring). `exacto: true` => el mensaje debe ser exactamente esa palabra.
// `respuesta` puede ser: string, array de strings (se elige uno al azar) o función.
const hoyAR = (opts) => new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Catamarca", ...opts });

const charla = [
  {
    palabras_clave: ["gracias", "muchas gracias", "te agradezco", "mil gracias"],
    respuesta: ["¡De nada! 😊 Para eso estoy.", "¡No hay de qué! Cualquier otra consulta, escribime. 🙌", "¡Un gusto ayudarte! 💙"],
  },
  {
    palabras_clave: ["chau", "adios", "hasta luego", "hasta pronto", "nos vemos", "me voy", "hasta mañana"],
    respuesta: ["¡Chau! 👋 Que tengas un lindo día.", "¡Hasta luego! Acá voy a estar cuando me necesites. 😊", "¡Nos vemos! Cuidate mucho. 👋"],
  },
  {
    palabras_clave: ["bien", "muy bien", "excelente", "genial", "barbaro", "perfecto", "buenisimo", "de diez"],
    exacto: true,
    respuesta: ["¡Qué bueno! 😄 ¿Te ayudo con algo del municipio? Escribí *menú* para ver las opciones.", "¡Me alegra! 🙌 Si necesitás algo, escribí *menú*."],
  },
  {
    palabras_clave: ["mal", "mas o menos", "triste", "cansado", "cansada", "agotado"],
    exacto: true,
    respuesta: ["Uh, lamento escuchar eso 😔 Ojalá mejore pronto. Si en algo puedo ayudarte, escribí *menú*.", "¡Ánimo! 💪 Mañana seguro es mejor. Cualquier cosa, acá estoy."],
  },
  {
    palabras_clave: ["ok", "okey", "dale", "bueno", "listo", "entendido", "vale", "joya"],
    exacto: true,
    respuesta: ["👍", "¡Perfecto! 😊", "¡Dale! Cualquier otra consulta, escribime."],
  },
  {
    regex: /^(j+a+j+[ja]*|j+e+j+[je]*|ja+|je+|ji+|xd+|lol|😂+|🤣+)$/i,
    palabras_clave: [],
    respuesta: ["😄", "¡Jaja! 😂", "😅 ¡Me alegra que te rías!"],
  },
  {
    palabras_clave: ["que haces", "que hacés", "que haces?", "en que andas", "que estas haciendo", "que hacias"],
    respuesta: ["Estoy acá esperando para ayudarte con tus consultas del municipio. 🤖 ¿Y vos, qué andás necesitando?", "Contestando consultas de los vecinos de Valle Viejo, ¡mi pasatiempo favorito! 😄"],
  },
  {
    palabras_clave: ["que podes hacer", "para que servis", "que sabes hacer", "que sabes", "en que me ayudas", "en que me podes ayudar", "para que sirves", "que funciones tenes"],
    respuesta: "🤖 Puedo darte información del municipio: horarios, ubicación, trámites, reclamos, Casa de la Juventud, Conviviendo, Medio Ambiente, turismo, postas sanitarias y deporte.\n\nEscribí *menú* para ver todas las opciones.",
  },
  {
    palabras_clave: ["sos humano", "sos una persona", "sos real", "hay alguien ahi", "hablo con una persona", "sos robot", "sos una maquina", "sos ia", "sos inteligencia artificial"],
    respuesta: "🤖 Soy un asistente virtual, no una persona. Pero hago lo posible por ayudarte como lo haría alguien de la Municipalidad. Si necesitás hablar con una persona, podés llamar al 03834443303.",
  },
  {
    palabras_clave: ["cuantos años tenes", "que edad tenes", "cuando naciste", "cuantos años tienes", "que edad tienes"],
    respuesta: "🎂 Soy una Inteligencia Artificial, así que no cumplo años como vos… ¡pero me gusta pensar que siempre tengo la energía de un recién estrenado! 😄",
  },
  {
    palabras_clave: ["donde vivis", "donde vives", "de donde sos", "de donde eres", "donde estas"],
    respuesta: "📍 Vivo en la nube, pero mi corazón está en Valle Viejo, Catamarca. 💙",
  },
  {
    palabras_clave: ["sos hombre o mujer", "sos hombre", "sos mujer", "sos chico o chica", "que genero sos"],
    respuesta: "🤖 Soy una Inteligencia Artificial, no tengo género. Me puse Felipe en honor a Felipe Varela. 😊",
  },
  {
    palabras_clave: ["quien fue felipe varela", "quien es felipe varela", "felipe varela", "por que te llamas felipe", "por que felipe"],
    respuesta: "🇦🇷 *Felipe Varela* (1821-1870) fue un caudillo y militar catamarqueño, nacido en Huillapima. Es recordado por su “Proclama a los pueblos americanos” (1866) y por defender a las provincias del interior. Por eso me llamo así, en su honor. 💙",
  },
  {
    palabras_clave: ["que hora es", "que hora son", "me decis la hora", "hora actual"],
    respuesta: () => `🕐 Son las ${hoyAR({ hour: "2-digit", minute: "2-digit" })} hs en Catamarca.`,
  },
  {
    palabras_clave: ["que dia es", "que fecha es", "fecha de hoy", "que dia es hoy", "a cuanto estamos"],
    respuesta: () => `📅 Hoy es ${hoyAR({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`,
  },
  {
    palabras_clave: ["clima", "va a llover", "hace calor", "hace frio", "temperatura", "pronostico"],
    respuesta: "🌤️ No tengo datos del clima en tiempo real, pero podés consultar el pronóstico oficial en https://www.smn.gob.ar/",
  },
  {
    palabras_clave: ["chiste", "contame un chiste", "decime un chiste", "haceme reir", "otro chiste"],
    respuesta: [
      "😄 ¿Por qué los pájaros vuelan hacia el sur? Porque caminando tardarían muchísimo.",
      "😂 ¿Qué le dice un bot a otro? “Nos vemos en la nube”.",
      "🤣 ¿Cómo se despiden los químicos? Ácido un placer.",
      "😅 ¿Qué hace una abeja en el gimnasio? ¡Zum-ba!",
      "😄 ¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas.",
    ],
  },
  {
    palabras_clave: ["curiosidad", "dato curioso", "contame algo", "decime algo", "sabias que", "algo interesante", "contame algo interesante"],
    respuesta: [
      "💡 Dato curioso: Valle Viejo se llamó así porque fue uno de los primeros asentamientos del valle de Catamarca. ¡Tiene mucha historia! 🏞️",
      "💡 ¿Sabías que desde la Cuesta del Portezuelo se pueden avistar cóndores? 🦅 Mirá la opción *Turismo* del menú.",
      "💡 Los pulpos tienen tres corazones. 🐙 ¡Nada que ver con Valle Viejo, pero me encanta el dato!",
      "💡 La miel es el único alimento que no se echa a perder. 🍯",
    ],
  },
  {
    palabras_clave: ["te quiero", "te amo", "sos lindo", "sos genial", "sos el mejor", "sos groso", "sos crack", "me caes bien", "sos muy util"],
    respuesta: ["¡Qué amable! 🥰 Yo también estoy contento de ayudarte.", "¡Gracias, me hacés el día! 😊"],
  },
  {
    palabras_clave: ["tenes novia", "tenes novio", "tenes pareja", "estas soltero", "queres ser mi novio", "queres ser mi amigo"],
    respuesta: "😅 Estoy casado con mi trabajo: ayudar a los vecinos de Valle Viejo. ¡Pero somos amigos! 🤝",
  },
  {
    palabras_clave: ["comida favorita", "que te gusta comer", "que comes", "tenes hambre"],
    respuesta: "🍽️ Como no tengo estómago, me alimento de electricidad y buenas consultas. ⚡ Pero si de comida catamarqueña hablamos… ¡un buen locro o unas empanadas! 🥟",
  },
  {
    palabras_clave: ["color favorito", "que color te gusta"],
    respuesta: "🎨 El celeste y blanco, por supuesto. 🇦🇷",
  },
  {
    palabras_clave: ["equipo favorito", "de que cuadro sos", "sos de boca", "sos de river", "de que equipo sos"],
    respuesta: "⚽ Soy neutral, ¡mi equipo es todo Valle Viejo! 💙",
  },
  {
    palabras_clave: ["hablas ingles", "hablas otro idioma", "speak english", "do you speak english", "hello"],
    respuesta: "🌎 Por ahora solo hablo español, pero estoy aprendiendo. ¡Escribí *menú* para ver las opciones! / I only speak Spanish for now. Type *menú* to see the options.",
  },
  {
    palabras_clave: ["puedo hacerte una pregunta", "te puedo preguntar algo", "tengo una pregunta", "una consulta"],
    respuesta: "¡Claro! 😊 Preguntame lo que quieras. Si es sobre el municipio, seguro te ayudo.",
  },
  {
    palabras_clave: ["boludo", "idiota", "estupido", "inutil", "tonto", "pelotudo", "no servis", "basura de bot"],
    respuesta: ["😔 Lamento que no haya podido ayudarte. Escribí *menú* para ver las opciones o llamá al 03834443303 para hablar con una persona.", "Perdoná si no te ayudé como esperabas. Estoy aprendiendo. 🙏"],
  },
  {
    palabras_clave: ["feliz cumpleaños", "es mi cumpleaños", "estoy de cumpleaños"],
    respuesta: "🎉 ¡Feliz cumpleaños! 🎂 Que la pases hermoso.",
  },
  {
    palabras_clave: ["feliz año", "feliz navidad", "feliz dia", "buen fin de semana", "buen finde"],
    respuesta: "🎊 ¡Igualmente! Que la pases muy bien. 💙",
  },
  {
    palabras_clave: ["sabes cantar", "canta algo", "cantame algo", "sabes bailar"],
    respuesta: "🎤 Cantaría, pero tengo voz de bot… Mejor te dejo un chiste: escribí *chiste*. 😄",
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

module.exports = { faqs, charla, submenus, bienvenida, noEntendido };
