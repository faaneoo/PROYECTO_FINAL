import { pool, estado } from './db.js';

// Objeto para guardar trazos en RAM si no hay BBDD: { 'sala1': [trazo1, trazo2...], 'sala2': [...] }
const memoriaTrazos = {};

// Envía un trazo al destino emitiendo el evento adecuado según su tipo
export function emitirTrazo(destino, trazo) {
  if (trazo.herramienta === 'fondo') {
    destino.emit('fondo_pizarra', trazo.fondo);
  } else {
    destino.emit('dibujar', trazo);
  }
}

// Obtiene el historial de trazos de una sala, desde BBDD o memoria RAM
export async function obtenerHistorial(sala) {
  if (estado.dbConnected) {
    const [rows] = await pool.query('SELECT datos FROM trazos WHERE sala = ? ORDER BY id ASC', [sala]);
    return rows.map(row => typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos);
  }
  return memoriaTrazos[sala] || [];
}

// Guarda un trazo en BBDD o memoria RAM
export async function guardarTrazo(sala, trazo) {
  if (estado.dbConnected) {
    await pool.query('INSERT INTO trazos (sala, datos) VALUES (?, ?)', [sala, JSON.stringify(trazo)]);
  } else {
    if (!memoriaTrazos[sala]) {
      memoriaTrazos[sala] = [];
    }
    memoriaTrazos[sala].push(trazo);
  }
}

// Elimina el último trazo de una sala
export async function eliminarUltimoTrazo(sala) {
  if (estado.dbConnected) {
    const [rows] = await pool.query('SELECT id FROM trazos WHERE sala = ? ORDER BY id DESC LIMIT 1', [sala]);
    if (rows.length > 0) {
      await pool.query('DELETE FROM trazos WHERE id = ?', [rows[0].id]);
      return true;
    }
    return false;
  }
  if (memoriaTrazos[sala] && memoriaTrazos[sala].length > 0) {
    memoriaTrazos[sala].pop();
    return true;
  }
  return false;
}

// Elimina todos los trazos de una sala
export async function vaciarSala(sala) {
  if (estado.dbConnected) {
    await pool.query('DELETE FROM trazos WHERE sala = ?', [sala]);
  } else if (memoriaTrazos[sala]) {
    memoriaTrazos[sala] = [];
  }
}
