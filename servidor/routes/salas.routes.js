import { Router } from 'express';
import crypto from 'crypto';
import { pool, estado } from '../db.js';
import { verificarToken } from '../middleware/auth.js';
import { registrarLog } from '../utils/logger.js';

const router = Router();
router.use(verificarToken);

function sinDB(res) {
  return res.status(503).json({ error: 'Base de datos no disponible. Inténtalo más tarde.' });
}

// Lista las salas del usuario (propias, donde es miembro, y la sala pública 'general')
router.get('/mias', async (req, res) => {
  if (!estado.dbConnected) return sinDB(res);

  try {
    const [filas] = await pool.query(
      `SELECT DISTINCT s.id, s.nombre, s.codigo, s.privada, s.propietario_id,
              (s.propietario_id = ?) AS esPropietaria
       FROM salas s
       LEFT JOIN salas_miembros m ON m.sala_id = s.id AND m.usuario_id = ?
       WHERE s.privada = FALSE OR s.propietario_id = ? OR m.usuario_id = ?
       ORDER BY s.privada DESC, s.fecha_creacion ASC`,
      [req.usuario.id, req.usuario.id, req.usuario.id, req.usuario.id]
    );
    res.json({ salas: filas });
  } catch (error) {
    console.error('Error listando salas:', error);
    res.status(500).json({ error: 'Error al listar las salas.' });
  }
});

// Crea una nueva sala privada propiedad del usuario
router.post('/', async (req, res) => {
  if (!estado.dbConnected) return sinDB(res);

  const { nombre } = req.body;
  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la sala es obligatorio.' });
  }

  try {
    const codigo = crypto.randomBytes(4).toString('hex');
    await pool.query(
      'INSERT INTO salas (nombre, codigo, privada, propietario_id) VALUES (?, ?, TRUE, ?)',
      [nombre, codigo, req.usuario.id]
    );
    await registrarLog(req.usuario.id, 'crear_sala', { nombre, codigo });

    res.status(201).json({ sala: { nombre, codigo, privada: true, propietario_id: req.usuario.id } });
  } catch (error) {
    console.error('Error creando sala:', error);
    res.status(500).json({ error: 'Error al crear la sala.' });
  }
});

// Une al usuario actual a una sala privada existente mediante su código
router.post('/unirse', async (req, res) => {
  if (!estado.dbConnected) return sinDB(res);

  const { codigo } = req.body;
  if (!codigo) {
    return res.status(400).json({ error: 'El código de sala es obligatorio.' });
  }

  try {
    const [filas] = await pool.query('SELECT * FROM salas WHERE codigo = ?', [codigo]);
    if (filas.length === 0) {
      return res.status(404).json({ error: 'No existe ninguna sala con ese código.' });
    }

    const sala = filas[0];

    if (!sala.privada || sala.propietario_id === req.usuario.id) {
      return res.json({ sala });
    }

    await pool.query(
      'INSERT IGNORE INTO salas_miembros (sala_id, usuario_id) VALUES (?, ?)',
      [sala.id, req.usuario.id]
    );
    await registrarLog(req.usuario.id, 'unirse_sala', { codigo });

    res.json({ sala });
  } catch (error) {
    console.error('Error uniéndose a la sala:', error);
    res.status(500).json({ error: 'Error al unirse a la sala.' });
  }
});

export default router;
