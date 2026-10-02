// Estado compartido del bot (en memoria)
// Tanto index.js como panel.js leen/escriben aquí.
module.exports = {
  online: false,
  connectedAt: null,
  qrCode: null,      // data URI del QR actual (null si ya está conectado)
};
