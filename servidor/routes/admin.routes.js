import { Router } from 'express';
import { pool, estado } from '../db.js';
import { verificarToken, requireAdmin } from '../middleware/auth.js';
import { vaciarSala } from '../trazos.js';

function sinDB(res) {
  return res.status(503).json({ error: 'Base de datos no disponible. Inténtalo más tarde.' });
}

// Crea el router de administración. Recibe `io` para poder notificar a las
// salas cuando un admin las vacía.
export default function crearAdminRouter(io) {
  const router = Router();
  router.use(verificarToken, requireAdmin);

  // --- Usuarios ---
  router.get('/usuarios', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    try {
      const [filas] = await pool.query(
        'SELECT id, nombre, email, rol, fecha_creacion FROM usuarios ORDER BY fecha_creacion ASC'
      );
      res.json({ usuarios: filas });
    } catch (error) {
      console.error('Error listando usuarios:', error);
      res.status(500).json({ error: 'Error al listar los usuarios.' });
    }
  });

  router.patch('/usuarios/:id', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    const { id } = req.params;
    const { rol } = req.body;

    if (!['usuario', 'admin'].includes(rol)) {
      return res.status(400).json({ error: "El rol debe ser 'usuario' o 'admin'." });
    }
    if (Number(id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });
    }

    try {
      await pool.query('UPDATE usuarios SET rol = ? WHERE id = ?', [rol, id]);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      res.status(500).json({ error: 'Error al actualizar el usuario.' });
    }
  });

  router.delete('/usuarios/:id', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    const { id } = req.params;

    if (Number(id) === req.usuario.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
    }

    try {
      await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      res.status(500).json({ error: 'Error al eliminar el usuario.' });
    }
  });

  // --- Salas ---
  router.get('/salas', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    try {
      const [filas] = await pool.query(`
        SELECT s.id, s.nombre, s.codigo, s.privada, s.fecha_creacion,
               u.nombre AS propietario, u.email AS propietario_email,
               (SELECT COUNT(*) FROM trazos t WHERE t.sala = s.codigo) AS num_trazos
        FROM salas s
        LEFT JOIN usuarios u ON u.id = s.propietario_id
        ORDER BY s.fecha_creacion ASC
      `);
      res.json({ salas: filas });
    } catch (error) {
      console.error('Error listando salas:', error);
      res.status(500).json({ error: 'Error al listar las salas.' });
    }
  });

  router.delete('/salas/:codigo/trazos', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    const { codigo } = req.params;

    try {
      await vaciarSala(codigo);
      io.in(codigo).emit('limpiar_lienzo');
      res.json({ ok: true });
    } catch (error) {
      console.error('Error vaciando sala:', error);
      res.status(500).json({ error: 'Error al vaciar la sala.' });
    }
  });

  // --- Logs ---
  router.get('/logs', async (req, res) => {
    if (!estado.dbConnected) return sinDB(res);
    const limite = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    try {
      const [filas] = await pool.query(
        `SELECT l.id, l.accion, l.detalles, l.fecha, u.nombre AS usuario, u.email AS usuario_email
         FROM logs l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
         ORDER BY l.fecha DESC
         LIMIT ? OFFSET ?`,
        [limite, offset]
      );
      res.json({ logs: filas });
    } catch (error) {
      console.error('Error listando logs:', error);
      res.status(500).json({ error: 'Error al listar los logs.' });
    }
  });

  return router;
}
