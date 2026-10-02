# Bot de WhatsApp - Municipio (Demo)

Chatbot simple que responde preguntas frecuentes por WhatsApp usando tu propio
número. Hecho con **Baileys**, que NO usa navegador (a diferencia de
whatsapp-web.js), así que es mucho más estable.

## Requisitos
- Node.js 18 o superior instalado en tu compu ([nodejs.org](https://nodejs.org))
- Tu celular con WhatsApp y conexión a internet
- Tu compu prendida y con internet mientras el bot esté "en vivo" (es como
  tener WhatsApp Web abierto)

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

Listo. Ahora cualquiera que te escriba a tu número recibe respuesta automática
del bot. **Tu número, tu nombre y tu foto de perfil siguen siendo los mismos**
porque el bot corre como un "dispositivo vinculado" de tu propia cuenta.

## Probarlo

Desde OTRO celular (no el mismo que vinculaste), escribile a tu número:
- "Hola" → te tira el menú de bienvenida
- "horarios" → responde el horario de atención
- "trámites" → lista los trámites disponibles
- "1" (después de pedir trámites) → info de libreta sanitaria

## Editar las respuestas

Todas las preguntas y respuestas están en **`faqs.js`**. Es un archivo simple,
podés agregar/editar entradas así:

```js
{
  keywords: ["basura", "residuos", "recoleccion"],
  respuesta: "🗑️ La recolección de residuos pasa Lunes, Miércoles y Viernes."
},
```

No hace falta reiniciar nada raro, solo guardá el archivo y volvé a correr
`npm start`.

## Para no perder la sesión (no escanear el QR cada vez)

La primera vez que te conectás se crea una carpeta `auth/` con las
credenciales de la sesión. Mientras no borres esa carpeta, podés apagar y
prender el bot (`npm start`) las veces que quieras sin volver a escanear el
QR.

⚠️ Esa carpeta `auth/` es sensible (es literalmente el acceso a tu WhatsApp).
No la compartas ni la subas a GitHub.

## Para el día del demo

- Dejá la compu con el bot corriendo (`npm start`) unos minutos antes de
  empezar, para asegurarte que conecte bien.
- Si algo se corta, Baileys reconecta solo. Si ves errores raros, `Ctrl+C` y
  `npm start` de nuevo.
- Si querés arrancar de cero (por ejemplo probaste con otro número), borrá la
  carpeta `auth/` y volvé a escanear el QR.

## Notas sobre "gratis"

- Baileys es 100% gratuito y open source, no tiene límite de mensajes.
- No necesitás cuenta de desarrollador ni verificación de Meta Business.
- Corre localmente en tu compu (para el demo alcanza y sobra). Si más
  adelante lo querés dejar prendido 24/7 sin depender de tu compu, se puede
  subir gratis a un servicio como Railway, Render o una VPS chica — pero para
  mañana no hace falta, esto corriendo en tu notebook durante la demo es
  perfectamente sólido.

## Aviso importante

Baileys usa el protocolo no-oficial de WhatsApp Web (ingeniería inversa). Es
la alternativa más usada y estable a whatsapp-web.js, y para un demo de bajo
volumen el riesgo de baneo es mínimo. Para un uso productivo del municipio a
futuro (alto volumen de mensajes, garantías, soporte), lo recomendable a
mediano plazo es migrar a la API oficial de WhatsApp Business (Meta Cloud
API), que también tiene un nivel gratuito.
