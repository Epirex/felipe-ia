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
| `TELEGRAM_BOT_TOKEN` | (Opcional) Token de BotFather para recibir alertas de desconexión. |
| `TELEGRAM_CHAT_ID` | (Opcional) Tu Chat ID de Telegram para recibir las alertas. |
| `TZ` | Zona horaria (ej: `America/Argentina/Catamarca`) para que las fechas coincidan localmente. |

### Configurar Healthcheck en Railway
Para que Railway sepa que la aplicación está viva y no la reinicie constantemente:
1. Andá a `Settings > Deploy`
2. En **Healthcheck Path**, escribí: `/health`
3. Política de reinicio recomendada: `On Failure`

### Alertas por Telegram
Si configurás `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`, el bot te avisará por Telegram si la sesión se cierra (loggedOut) o si se desconecta de WhatsApp por más de 5 minutos, así como cuando se recupere. Podés crear tu bot hablando con `@BotFather` en Telegram y obtener tu Chat ID enviándole un mensaje a tu propio bot y revisando la API de Telegram o usando un bot como `@userinfobot`.

### Volúmenes (Importante)
Agregá un **Volume** en Railway montado en `/app/data`. Allí se guardarán los datos de la base de datos SQLite y la sesión de WhatsApp (`auth/`). Si no configurás un volumen, perderás el historial de chats y tendrás que re-escanear el código QR en cada reinicio o despliegue.
