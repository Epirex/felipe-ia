// ============================================================
// TRANSCRIPCIÓN DE NOTAS DE VOZ — Groq (Whisper)
// Usa fetch/FormData/Blob nativos de Node 22: no requiere librerías externas.
// Variable necesaria: GROQ_API_KEY (también se acepta groq_api_key)
// Plan gratuito: 20 pedidos/min, 2.000/día, 8 horas de audio/día.
// ============================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.groq_api_key || null;
const GROQ_URL     = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO       = "whisper-large-v3-turbo";

// Audios más largos que esto no se transcriben (evita abusos y gastar cupo)
const MAX_SEGUNDOS_AUDIO = 60;

function transcripcionDisponible() {
  return Boolean(GROQ_API_KEY);
}

/**
 * Transcribe un audio (Buffer en formato OGG/Opus, como los manda WhatsApp).
 * Devuelve el texto transcripto o lanza un error.
 */
async function transcribirAudio(buffer) {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY no configurada");

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "audio/ogg" }), "audio.ogg");
  form.append("model", MODELO);
  form.append("language", "es");          // forzar español mejora la precisión
  form.append("response_format", "json");
  form.append("temperature", "0");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000); // 20 s máximo

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`Groq respondió ${res.status}: ${detalle.slice(0, 200)}`);
    }

    const data = await res.json();
    return limpiarTranscripcion(data.text || "");
  } finally {
    clearTimeout(timeout);
  }
}

// Números dichos en voz alta → dígito, para que "siete" funcione como la opción 7 del menú
const NUMEROS = {
  uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5", seis: "6",
  siete: "7", ocho: "8", nueve: "9", diez: "10", once: "11", doce: "12",
};

function limpiarTranscripcion(texto) {
  // Whisper agrega puntuación ("Siete.", "¿Hola?"): la sacamos de los extremos
  let t = texto.trim().replace(/^[¿¡"'\s]+|[.,;:!?¡¿"'\s]+$/g, "");

  // Si dijo solo un número ("siete", "opción siete", "el 7"), devolver el dígito
  const solo = t.toLowerCase().replace(/^(la |el )?(opcion|opción|numero|número)\s+/, "").replace(/^(la |el )/, "");
  if (NUMEROS[solo]) return NUMEROS[solo];
  if (/^\d{1,2}$/.test(solo)) return solo;

  return t;
}

module.exports = { transcribirAudio, transcripcionDisponible, MAX_SEGUNDOS_AUDIO, limpiarTranscripcion };
