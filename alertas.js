const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const ultimaAlertaPorTipo = new Map();
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutes

async function notificarAlerta(tipo, mensaje, logger) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  const ultimo = ultimaAlertaPorTipo.get(tipo) || 0;
  if (Date.now() - ultimo < THROTTLE_MS) {
    if (logger) logger.warn(`[Alertas] Alerta '${tipo}' rate-limited. Ignorando.`);
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: mensaje,
      }),
    });

    if (!response.ok) {
      if (logger) logger.error(`[Alertas] Fallo al enviar a Telegram: ${response.status} ${response.statusText}`);
    } else {
      ultimaAlertaPorTipo.set(tipo, Date.now());
      if (logger) logger.info(`[Alertas] Mensaje enviado a Telegram (${tipo})`);
    }
  } catch (err) {
    if (logger) logger.error(`[Alertas] Excepción enviando a Telegram: ${err.message}`);
  }
}

module.exports = { notificarAlerta };
