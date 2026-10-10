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
| `TZ` | Zona horaria (ej: `America/Argentina/Catamarca`) para que las fechas coincidan localmente. |

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
