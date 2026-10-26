// ============================================================
// PANEL DE RECLAMOS — login propio por usuario (direcciones) + admin
//
// - Admin: usa ADMIN_USER / ADMIN_PASS. Ve todo, edita, elimina y administra usuarios.
// - Áreas (secretarías/direcciones): usuarios guardados en la base con contraseña
//   encriptada (scrypt). Solo ven los reclamos de sus categorías y SOLO pueden
//   cambiar el estado (+ comentario). Nunca editar ni eliminar.
// Los permisos se validan siempre en el servidor, no en la pantalla.
// ============================================================

const express = require("express");
const path    = require("path");
const crypto  = require("crypto");
const {
  ESTADOS,
  getReclamos,
  getReclamoPorId,
  actualizarReclamo,
  cambiarEstadoReclamo,
  eliminarReclamo,
  getEstadisticasReclamos,
  crearUsuarioReclamos,
  listarUsuariosReclamos,
  getUsuarioReclamos,
  actualizarUsuarioReclamos,
  eliminarUsuarioReclamos,
  verificarUsuarioReclamos,
} = require("./db");
const { CATEGORIAS } = require("./reclamos");

const SESION_MS = 12 * 60 * 60 * 1000; // 12 horas
const COOKIE = "rsid";
const MAX_FALLOS = 10;
const BLOQUEO_MS = 15 * 60 * 1000;

const sesiones = new Map();   // token → { usuario, rol, exp }
const fallosLogin = new Map(); // IP → { intentos, desde }

function hashSha(s) {
  return crypto.createHash("sha256").update(String(s ?? "")).digest();
}
function iguales(a, b) {
  return crypto.timingSafeEqual(hashSha(a), hashSha(b));
}

function leerCookie(req, nombre) {
  const h = req.headers.cookie || "";
  for (const parte of h.split(";")) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return null;
}

function poner(req, res, token, maxAgeSeg) {
  const seguro = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSeg}${seguro ? "; Secure" : ""}`
  );
}

const jsonParser = express.json({ limit: "50kb" });

function crearRouterReclamos(getAdmin) {
  const router = express.Router();

  // ── Sesión: devuelve { usuario, nombre, rol, categorias } o null ──
  // Para las áreas se relee el usuario de la base en cada pedido, así un cambio de
  // categorías o un borrado del usuario tiene efecto inmediato.
  function sesionDe(req) {
    const token = leerCookie(req, COOKIE);
    const s = token && sesiones.get(token);
    if (!s) return null;
    if (Date.now() > s.exp) { sesiones.delete(token); return null; }
    if (s.rol === "admin") return { usuario: s.usuario, nombre: "Administrador", rol: "admin", categorias: CATEGORIAS };
    const u = getUsuarioReclamos(s.usuario);
    if (!u) { sesiones.delete(token); return null; }
    return { usuario: u.usuario, nombre: u.nombre, rol: "area", categorias: u.categorias };
  }

  function requerirSesion(req, res, next) {
    res.setHeader("Cache-Control", "no-store");
    const s = sesionDe(req);
    if (!s) return res.status(401).json({ error: "Sesión no iniciada" });
    req.sesion = s;
    next();
  }
  function requerirAdmin(req, res, next) {
    if (req.sesion.rol !== "admin") return res.status(403).json({ error: "Solo el administrador puede hacer esto." });
    next();
  }
  // null = todas las categorías (admin); array = solo las del área
  const categoriasVisibles = (s) => (s.rol === "admin" ? null : s.categorias);

  // ── Página (el HTML no trae datos; los datos exigen sesión) ──
  router.get("/reclamos", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(__dirname, "public", "reclamos.html"));
  });

  // ── Login / logout / sesión ──
  router.post("/api/reclamos/login", jsonParser, (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const ip = req.ip;
    const ahora = Date.now();
    const est = fallosLogin.get(ip) || { intentos: 0, desde: ahora };
    if (ahora - est.desde > BLOQUEO_MS) { est.intentos = 0; est.desde = ahora; }
    if (est.intentos >= MAX_FALLOS) {
      fallosLogin.set(ip, est);
      return res.status(429).json({ error: "Demasiados intentos fallidos. Probá más tarde." });
    }

    const usuario = typeof req.body?.usuario === "string" ? req.body.usuario.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    let rol = null;
    let clave = null;

    const admin = getAdmin();
    if (admin?.user && admin?.pass && iguales(usuario, admin.user) && iguales(password, admin.pass)) {
      rol = "admin"; clave = admin.user;
    } else if (usuario && password && password.length <= 200) {
      const u = verificarUsuarioReclamos(usuario.toLowerCase(), password);
      if (u) { rol = "area"; clave = u.usuario; }
    }

    if (!rol) {
      est.intentos++; est.desde = ahora;
      fallosLogin.set(ip, est);
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    fallosLogin.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sesiones.set(token, { usuario: clave, rol, exp: ahora + SESION_MS });
    poner(req, res, token, SESION_MS / 1000);
    res.json({ ok: true });
  });

  router.post("/api/reclamos/logout", (req, res) => {
    const token = leerCookie(req, COOKIE);
    if (token) sesiones.delete(token);
    poner(req, res, "", 0);
    res.json({ ok: true });
  });

  router.get("/api/reclamos/sesion", requerirSesion, (req, res) => {
    const { usuario, nombre, rol, categorias } = req.sesion;
    res.json({ usuario, nombre, rol, categorias });
  });

  // ── Reclamos ──
  router.get("/api/reclamos", requerirSesion, (req, res) => {
    try {
      const cats = categoriasVisibles(req.sesion);
      res.json({
        reclamos: getReclamos(5000, cats),
        stats: getEstadisticasReclamos(cats),
        categorias: CATEGORIAS,
        estados: ESTADOS,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cambiar estado + comentario: permitido a admin y a áreas (solo sobre sus categorías)
  router.patch("/api/reclamos/:id/estado", requerirSesion, jsonParser, (req, res) => {
    try {
      const id = Number(req.params.id);
      const estado = req.body?.estado;
      const respuesta = typeof req.body?.respuesta === "string" ? req.body.respuesta.trim().slice(0, 500) : "";
      if (!Number.isInteger(id) || !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: "Datos inválidos." });
      }
      const r = getReclamoPorId(id);
      // 404 (y no 403) si no le corresponde, para no revelar reclamos de otras áreas
      if (!r || (req.sesion.rol !== "admin" && !req.sesion.categorias.includes(r.categoria))) {
        return res.status(404).json({ error: "Reclamo no encontrado." });
      }
      cambiarEstadoReclamo(id, { estado, respuesta, por: req.sesion.nombre });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Editar datos del reclamo: SOLO admin
  router.put("/api/reclamos/:id", requerirSesion, requerirAdmin, jsonParser, (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const limpiar = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      const datos = {
        nombre:    limpiar(b.nombre, 100),
        dni:       limpiar(b.dni, 20),
        domicilio: limpiar(b.domicilio, 200),
        categoria: limpiar(b.categoria, 50),
        detalle:   limpiar(b.detalle, 2000),
        telefono:  limpiar(b.telefono, 30),
      };
      if (!Number.isInteger(id) || !datos.nombre || !datos.dni || !datos.domicilio || !datos.detalle) {
        return res.status(400).json({ error: "Nombre, DNI, domicilio y detalle son obligatorios." });
      }
      if (!CATEGORIAS.includes(datos.categoria)) return res.status(400).json({ error: "Categoría inválida." });
      if (!actualizarReclamo(id, datos)) return res.status(404).json({ error: "Reclamo no encontrado." });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Eliminar: SOLO admin
  router.delete("/api/reclamos/:id", requerirSesion, requerirAdmin, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });
      if (!eliminarReclamo(id)) return res.status(404).json({ error: "Reclamo no encontrado." });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Excel (cada usuario baja solo lo suyo) ──
  router.get("/api/export/reclamos.xlsx", requerirSesion, async (req, res) => {
    try {
      const ExcelJS = require("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Reclamos");
      ws.columns = [
        { header: "N°",                  key: "id",        width: 8 },
        { header: "Fecha y hora",        key: "fecha",     width: 20 },
        { header: "Estado",              key: "estado",    width: 13 },
        { header: "Categoría",           key: "categoria", width: 20 },
        { header: "Nombre completo",     key: "nombre",    width: 30 },
        { header: "DNI",                 key: "dni",       width: 14 },
        { header: "Domicilio / lugar",   key: "domicilio", width: 35 },
        { header: "Detalle del reclamo", key: "detalle",   width: 70 },
        { header: "Respuesta del área",  key: "respuesta", width: 45 },
        { header: "Teléfono",            key: "telefono",  width: 18 },
        { header: "Vía",                 key: "via",       width: 10 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00658E" } };
      ws.views = [{ state: "frozen", ySplit: 1 }];

      for (const r of getReclamos(5000, categoriasVisibles(req.sesion))) {
        // Todo se guarda como texto: ExcelJS no interpreta fórmulas en strings (sin riesgo de inyección)
        ws.addRow({
          id: r.id, fecha: r.fecha, estado: r.estado, categoria: r.categoria, nombre: r.nombre,
          dni: String(r.dni), domicilio: r.domicilio, detalle: r.detalle, respuesta: r.respuesta || "",
          telefono: r.telefono ? String(r.telefono) : "", via: r.via_audio ? "Audio" : "Texto",
        });
      }
      ws.eachRow((row) => { row.alignment = { vertical: "top", wrapText: true }; });

      const fechaHoy = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="reclamos-${fechaHoy}.xlsx"`);
      const buffer = await wb.xlsx.writeBuffer();
      res.send(Buffer.from(buffer));
    } catch (err) {
      res.status(500).send("Error al generar Excel: " + err.message);
    }
  });

  // ── Administración de usuarios (SOLO admin) ──
  function validarUsuario(b, { creando }) {
    const nombre = typeof b?.nombre === "string" ? b.nombre.trim() : "";
    const password = typeof b?.password === "string" ? b.password : "";
    const categorias = Array.isArray(b?.categorias) ? [...new Set(b.categorias)] : [];
    if (nombre.length < 2 || nombre.length > 80) return { error: "El nombre del área debe tener entre 2 y 80 caracteres." };
    if (!categorias.length || !categorias.every((c) => CATEGORIAS.includes(c))) return { error: "Elegí al menos una categoría válida." };
    if ((creando || password) && (password.length < 8 || password.length > 100)) return { error: "La contraseña debe tener entre 8 y 100 caracteres." };
    return { nombre, password, categorias };
  }

  router.get("/api/reclamos-usuarios", requerirSesion, requerirAdmin, (req, res) => {
    res.json({ usuarios: listarUsuariosReclamos() });
  });

  router.post("/api/reclamos-usuarios", requerirSesion, requerirAdmin, jsonParser, (req, res) => {
    try {
      const usuario = typeof req.body?.usuario === "string" ? req.body.usuario.trim().toLowerCase() : "";
      if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
        return res.status(400).json({ error: "El usuario debe tener 3 a 30 caracteres: letras, números, punto, guion o guion bajo." });
      }
      const admin = getAdmin();
      if (admin?.user && usuario === String(admin.user).toLowerCase()) {
        return res.status(400).json({ error: "Ese nombre de usuario está reservado." });
      }
      const v = validarUsuario(req.body, { creando: true });
      if (v.error) return res.status(400).json({ error: v.error });
      crearUsuarioReclamos({ usuario, nombre: v.nombre, password: v.password, categorias: v.categorias });
      res.json({ ok: true });
    } catch (err) {
      if (/UNIQUE/i.test(err.message)) return res.status(409).json({ error: "Ya existe un usuario con ese nombre." });
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/api/reclamos-usuarios/:id", requerirSesion, requerirAdmin, jsonParser, (req, res) => {
    try {
      const id = Number(req.params.id);
      const v = validarUsuario(req.body, { creando: false });
      if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });
      if (v.error) return res.status(400).json({ error: v.error });
      if (!actualizarUsuarioReclamos(id, { nombre: v.nombre, categorias: v.categorias, password: v.password })) {
        return res.status(404).json({ error: "Usuario no encontrado." });
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/api/reclamos-usuarios/:id", requerirSesion, requerirAdmin, (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "ID inválido." });
      if (!eliminarUsuarioReclamos(id)) return res.status(404).json({ error: "Usuario no encontrado." });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { crearRouterReclamos };
