const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Realiza una petición a la API REST del servidor, adjuntando el token JWT
// (si existe) y parseando la respuesta JSON. Lanza un Error con el mensaje
// del servidor si la respuesta no es satisfactoria.
export async function apiFetch(path, { token, ...opciones } = {}) {
  const headers = { 'Content-Type': 'application/json', ...opciones.headers };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const respuesta = await fetch(`${API_URL}${path}`, { ...opciones, headers });
  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(datos.error || 'Error en la petición.');
  }
  return datos;
}
