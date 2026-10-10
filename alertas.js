const nodemailer = require("nodemailer");
const dns = require("dns");

// Forzar IPv4 globalmente. Node.js 18+ prioriza IPv6, lo cual falla en
// algunos contenedores de Railway al intentar conectar a smtp.gmail.com
dns.setDefaultResultOrder("ipv4first");

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS; // Contraseña de aplicación de Google
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO; // A quién enviar la alerta

const ultimaAlertaPorTipo = new Map();
const THROTTLE_MS = 10 * 60 * 1000; // 10 minutos (no enviar la misma alerta más de 1 vez cada 10 min)

let transporter = null;
if (GMAIL_USER && GMAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // usa STARTTLS
    requireTLS: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_PASS,
    },
    // Esto es CLAVE: le dice a Node que use IPv4 sí o sí para el socket,
    // ignorando por completo IPv6 (que es lo que falla en Railway).
    family: 4
  });
}

async function notificarAlerta(tipo, mensaje, logger) {
  if (!transporter || !ALERT_EMAIL_TO) return;

  const ultimo = ultimaAlertaPorTipo.get(tipo) || 0;
  if (Date.now() - ultimo < THROTTLE_MS) {
    if (logger) logger.warn(`[Alertas] Alerta '${tipo}' rate-limited. Ignorando para no hacer spam.`);
    return;
  }

  try {
    const mailOptions = {
      from: `"Felipe IA Bot" <${GMAIL_USER}>`,
      to: ALERT_EMAIL_TO,
      subject: `[Alerta] Felipe IA - ${tipo.toUpperCase()}`,
      text: mensaje,
      html: `<h3>Alerta del Bot - Municipio de Valle Viejo</h3><p>${mensaje}</p>`,
    };

    await transporter.sendMail(mailOptions);
    ultimaAlertaPorTipo.set(tipo, Date.now());
    if (logger) logger.info(`[Alertas] Correo enviado exitosamente (${tipo})`);
  } catch (err) {
    if (logger) logger.error(`[Alertas] Excepción enviando correo: ${err.message}`);
  }
}

module.exports = { notificarAlerta };
