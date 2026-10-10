// ============================================================
// MÓDULO DE ALERTAS — usa Resend (HTTP API) en lugar de SMTP
// No requiere librerías externas, usa fetch nativo de Node 22.
// Variables necesarias: RESEND_API_KEY, ALERT_EMAIL_TO
// ============================================================

const RESEND_API_KEY  = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO  = process.env.ALERT_EMAIL_TO; // A quién llega la alerta

// Anti-spam: no mandar más de 1 alerta del mismo tipo cada 10 minutos
const ultimaAlertaPorTipo = new Map();
const THROTTLE_MS = 10 * 60 * 1000;

async function notificarAlerta(tipo, mensaje, logger) {
  if (!RESEND_API_KEY || !ALERT_EMAIL_TO) return;

  const ultimo = ultimaAlertaPorTipo.get(tipo) || 0;
  if (Date.now() - ultimo < THROTTLE_MS) {
    if (logger) logger.warn(`[Alertas] '${tipo}' rate-limited, ignorando.`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Felipe IA Bot <onboarding@resend.dev>",
        to:   [ALERT_EMAIL_TO],
        subject: `[Alerta] Felipe IA — ${tipo.toUpperCase()}`,
        text: mensaje,
        html: `<h3>⚠️ Alerta del Bot — Municipio de Valle Viejo</h3><p>${mensaje}</p>`,
      }),
    });

    if (res.ok) {
      ultimaAlertaPorTipo.set(tipo, Date.now());
      if (logger) logger.info(`[Alertas] Correo enviado exitosamente (${tipo})`);
    } else {
      const body = await res.text();
      if (logger) logger.error(`[Alertas] Error de Resend (${res.status}): ${body}`);
    }
  } catch (err) {
    if (logger) logger.error(`[Alertas] Excepción enviando correo: ${err.message}`);
  }
}

module.exports = { notificarAlerta };
