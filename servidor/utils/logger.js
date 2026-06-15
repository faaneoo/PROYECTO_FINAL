import { pool, estado } from '../db.js';

// Registra una acción de auditoría. No falla nunca: si la BBDD no está
// disponible, simplemente se omite el registro.
export async function registrarLog(usuarioId, accion, detalles = null) {
  if (!estado.dbConnected) return;
  try {
    await pool.query(
      'INSERT INTO logs (usuario_id, accion, detalles) VALUES (?, ?, ?)',
      [usuarioId ?? null, accion, detalles !== null ? JSON.stringify(detalles) : null]
    );
  } catch (error) {
    console.error('Error registrando log:', error);
  }
}
