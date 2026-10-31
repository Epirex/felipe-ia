# Bot de WhatsApp - Municipio (Felipe IA)

Chatbot simple que responde preguntas frecuentes por WhatsApp usando un número propio. Hecho con **Baileys**, que NO usa navegador (a diferencia de whatsapp-web.js), por lo que es mucho más liviano y estable.

## Requisitos Locales
- Node.js 22.5 o superior instalado en tu compu ([nodejs.org](https://nodejs.org))
- Tu celular con WhatsApp y conexión a internet

## Instalación (una sola vez)

1. Abrí una terminal en esta carpeta.
2. Instalá las dependencias:
   ```
   npm install
   ```

## Cómo iniciar el bot

```
npm start
```

Va a aparecer un **código QR en la terminal**. Escaneálo desde tu WhatsApp:
1. Abrí WhatsApp en tu celular
2. Andá a **Configuración > Dispositivos vinculados > Vincular un dispositivo**
3. Escaneá el QR que aparece en la terminal

A los pocos segundos vas a ver:
```
✅ Bot conectado y funcionando.
```

## Editar las respuestas

Todas las preguntas y respuestas están en **`faqs.js`**. Es un archivo simple, podés agregar/editar entradas ahí y volver a iniciar el bot para probarlas.

---

## 🚀 Despliegue en Railway (Variables de Entorno)

Para que el bot funcione 24/7 en producción (Railway), debés configurar las siguientes **Variables de Entorno** (`Variables` en Railway):

| Variable | Descripción |
|----------|-------------|
| `ADMIN_USER` | Usuario para ingresar al panel de administración. **OBLIGATORIO en producción.** |
| `ADMIN_PASS` | Contraseña para ingresar al panel. **OBLIGATORIO en producción.** |
| `AUTH_FOLDER` | Directorio donde guardar la sesión de WhatsApp (ej: `/app/data/auth`). Requiere Volumen. |
| `DB_PATH` | Ubicación de la base de datos (ej: `/app/data/bot.db`). Requiere Volumen. |
| `PHONE_NUMBER` | (Opcional) Tu número con código de país para vincular usando código en vez de QR (ej: `5493834...`). |
| `RESEND_API_KEY` | (Opcional) API Key de Resend para enviar alertas de desconexión por correo. |
| `ALERT_EMAIL_TO` | (Opcional) Correo electrónico que recibirá las alertas (ej: el tuyo personal). |
| `GROQ_API_KEY` | (Opcional) API Key de [Groq](https://console.groq.com) para transcribir notas de voz con Whisper. Sin ella, el bot pide que le escriban. |
| `TZ` | Zona horaria (ej: `America/Argentina/Catamarca`) para que las fechas coincidan localmente. |
| `BACKUP_EMAIL_TO` | (Recomendado) Correo institucional que recibe la copia diaria de la base como adjunto. Requiere `RESEND_API_KEY`. |
| `BACKUP_DIAS` | (Opcional) Cuántos backups diarios conservar. Por defecto `14`. |
| `BACKUP_DIR` | (Opcional) Carpeta de los backups. Por defecto `backups/` junto a la base (dentro del volumen). |
| `BACKUP_DESACTIVADO` | (Opcional) `1` para apagar los backups automáticos. |

### Backups de la base de datos
El bot genera **una copia por día** de la base (reclamos, estadísticas, usuarios de áreas), comprimida (`bot-AAAA-MM-DD.db.gz`), y conserva los últimos `BACKUP_DIAS`. Si falta la del día (por un reinicio o deploy), la crea al arrancar. Si falla, avisa por correo.

Hay tres capas, usá al menos las dos primeras:
1. **Local (automático):** carpeta `backups/` dentro del volumen. Protege de borrados o errores, pero **no** de perder el volumen.
2. **Fuera del servidor (recomendado):** definí `BACKUP_EMAIL_TO` y la copia del día llega por correo. ⚠️ Contiene DNI y domicilios: usá una casilla institucional con acceso restringido.
3. **Manual:** botón **Backup** del panel principal (o `/api/backup/descargar`, requiere login de admin) para bajar una copia en el momento. Conviene bajar una antes de cada deploy importante.

Además, activá los **backups del volumen en Railway** (Volume → Backups), que cubren también la sesión de WhatsApp.

#### Restaurar un backup
1. Detené el servicio (o desplegá con el volumen sin la base).
2. Descomprimí el archivo: `gunzip bot-AAAA-MM-DD.db.gz` → queda `bot-AAAA-MM-DD.db`.
3. Copialo como `bot.db` en la ruta de `DB_PATH` (ej. `/app/data/bot.db`), reemplazando la actual.
4. Iniciá el servicio y verificá en `/reclamos` que estén los datos.

### Configurar Healthcheck en Railway
Para que Railway sepa que la aplicación está viva y no la reinicie constantemente:
1. Andá a `Settings > Deploy`
2. En **Healthcheck Path**, escribí: `/health`
3. Política de reinicio recomendada: `On Failure`

### Alertas por Correo (Resend)
El bot usa [Resend](https://resend.com) para enviar alertas por correo — es gratuito hasta 3.000 mails/mes y funciona vía HTTP, por lo que no tiene restricciones de red en Railway.
Para configurarlo:
1. Creá una cuenta gratuita en https://resend.com.
2. Andá a **API Keys** y creá una nueva. Copiá la clave (`re_...`).
3. En Railway, agregá las variables `RESEND_API_KEY` (la clave) y `ALERT_EMAIL_TO` (el correo donde querés recibir los avisos).
El bot te avisará si la sesión de WhatsApp se cierra o se desconecta por más de 5 minutos, y también cuando se recupere.

### Volúmenes (Importante)
Agregá un **Volume** en Railway montado en `/app/data`. Allí se guardarán los datos de la base de datos SQLite y la sesión de WhatsApp (`auth/`). Si no configurás un volumen, perderás el historial de chats y tendrás que re-escanear el código QR en cada reinicio o despliegue.
