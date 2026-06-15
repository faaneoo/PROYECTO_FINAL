# 🎨 Pizarra Virtual Colaborativa

¡Bienvenido al repositorio de la **Pizarra Virtual Colaborativa**! Este es un entorno web interactivo diseñado para equipos y educación, donde múltiples usuarios pueden conectarse a una misma sala virtual y dibujar o tomar notas sobre documentos compartidos en **tiempo real**.

## 🌟 Características Principales

- **Sincronización en Tiempo Real:** Todos los trazos y acciones se reflejan instantáneamente en las pantallas de todos los usuarios de la sala gracias a WebSockets.
- **Herramientas de Dibujo Avanzadas:** Lápiz de dibujo libre, creador de líneas rectas, rectángulos y círculos perfectos. Selector de color y grosor.
- **Soporte de PDF (Pizarra Documental):** Permite subir archivos PDF locales. La primera página se procesa en el cliente, se renderiza con calidad *High-DPI* y se establece como fondo para que todos los colaboradores puedan tomar apuntes encima.
- **Función Deshacer (Ctrl+Z):** Borra el último trazo insertado en la sala instantáneamente.
- **Exportación:** Guarda el resultado final de la pizarra (fondo + anotaciones) en un archivo PNG de alta resolución.
- **Persistencia de Datos:** Todos los eventos gráficos se almacenan en una base de datos MySQL, garantizando que el progreso no se pierda al recargar la página o al unirse nuevos miembros.
- **Diseño Premium:** Interfaz de usuario moderna y fluida basada en *Glassmorphism* (efecto cristal translúcido).

## 🛠️ Stack Tecnológico

El proyecto sigue una arquitectura Cliente-Servidor separada:

*   **Frontend (Cliente):** 
    *   [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
    *   HTML5 Canvas API (renderizado gráfico)
    *   [PDF.js](https://mozilla.github.io/pdf.js/) (Renderizado de documentos)
    *   Socket.io-client
*   **Backend (Servidor):**
    *   [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
    *   [Socket.io](https://socket.io/) (Motor WebSockets)
    *   [MySQL2](https://www.npmjs.com/package/mysql2) (Persistencia)

## 📋 Prerrequisitos

Para ejecutar este proyecto en tu máquina local, necesitarás tener instalado:

1.  **Node.js** (v18 o superior).
2.  **MySQL Server** (Puede ser a través de XAMPP, WAMP, o nativo).

## 🚀 Instalación y Ejecución

El proyecto está dividido en dos carpetas: `cliente` y `servidor`. Debes ejecutar ambas simultáneamente.

### 1. Configurar la Base de Datos
Asegúrate de tener encendido tu servidor MySQL (por defecto configurado en el puerto `3307`, usuario `root` sin contraseña).
El servidor NodeJS creará automáticamente la base de datos `pizarra_db` y la tabla `trazos` en su primer arranque.

### 2. Arrancar el Servidor (Backend)
Abre una terminal en la carpeta principal del proyecto y ejecuta:

```bash
cd servidor
npm install
cp .env.example .env   # ajusta host/puerto/usuario/contraseña de MySQL si es necesario
npm run dev
```
El servidor quedará escuchando en `http://localhost:3001` (configurable mediante `PORT` en `.env`).

### 3. Arrancar el Cliente (Frontend)
Abre **otra** terminal en la carpeta principal del proyecto y ejecuta:

```bash
cd cliente
npm install
cp .env.example .env   # ajusta VITE_SOCKET_URL si el backend no está en localhost:3001
npm run dev
```
El cliente de React se iniciará y podrás acceder a la aplicación abriendo tu navegador en `http://localhost:5173`.

## 🧑‍💻 Cómo Probar la Colaboración
1. Abre tu navegador en `http://localhost:5173`.
2. Abre una ventana en modo Incógnito (u otro navegador) en la misma dirección.
3. Lo que dibujes o el PDF que subas en una ventana aparecerá automáticamente en la otra como por arte de magia.

## 🌐 Despliegue Online (Render + Vercel)

El proyecto está preparado para desplegarse gratis con **Render** (backend) y **Vercel** (frontend), ambos conectados a este repositorio de GitHub.

### 1. Backend en Render
1. Entra en [render.com](https://render.com) e inicia sesión con tu cuenta de GitHub.
2. **New > Blueprint** y selecciona este repositorio (Render detectará el archivo `render.yaml` en la raíz).
3. Render creará el servicio `pizarra-servidor` (carpeta `servidor`). Configura las variables de entorno que pida (puedes dejarlas vacías para usar los valores por defecto y el Modo Memoria RAM si no tienes MySQL):
   - `CORS_ORIGIN`: déjalo en `*` por ahora (lo ajustaremos en el paso 3).
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: solo si tienes una base de datos MySQL accesible desde internet (p.ej. Railway, Aiven, Clever Cloud). Si los dejas vacíos, el servidor funcionará en Modo Memoria RAM.
4. Despliega. Cuando termine, copia la URL pública, p.ej. `https://pizarra-servidor.onrender.com`.

> ⚠️ En el plan gratuito de Render, el servicio "duerme" tras ~15 min de inactividad y tarda unos segundos en despertar con la primera conexión.

### 2. Frontend en Vercel
1. Entra en [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. **Add New > Project** y selecciona este repositorio.
3. En **Root Directory** elige `cliente` (Vercel detectará automáticamente Vite gracias a `vercel.json`).
4. Añade la variable de entorno:
   - `VITE_SOCKET_URL` = la URL de Render del paso anterior (p.ej. `https://pizarra-servidor.onrender.com`).
5. Despliega. Obtendrás una URL pública, p.ej. `https://pizarra-virtual.vercel.app`.

### 3. Conectar ambos (CORS)
1. Vuelve a Render, abre el servicio `pizarra-servidor` → **Environment**.
2. Cambia `CORS_ORIGIN` por la URL de Vercel del paso anterior (p.ej. `https://pizarra-virtual.vercel.app`). Puedes poner varias separadas por comas si necesitas mantener también `http://localhost:5173` para desarrollo.
3. Guarda y espera a que el servicio se redespliegue.

Listo: la pizarra ya estará disponible online en la URL de Vercel, con sincronización en tiempo real a través del backend de Render.

---

*Desarrollado como Proyecto Final (DAW/DAM).*
