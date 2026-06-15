import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, estado } from '../db.js';
import { verificarToken } from '../middleware/auth.js';
import { registrarLog } from '../utils/logger.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

function generarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function sinDB(res) {
  return res.status(503).json({ error: 'Base de datos no disponible. Inténtalo más tarde.' });
}

router.post('/registro', async (req, res) => {
  if (!estado.dbConnected) return sinDB(res);

  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan campos: nombre, email y password son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const rol = email === ADMIN_EMAIL ? 'admin' : 'usuario';

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, passwordHash, rol]
    );
    const usuarioId = resultado.insertId;

    // Crear sala privada personal
    const codigo = crypto.randomBytes(4).toString('hex');
    await pool.query(
      'INSERT INTO salas (nombre, codigo, privada, propietario_id) VALUES (?, ?, TRUE, ?)',
      ['Mi Pizarra', codigo, usuarioId]
    );

    const usuario = { id: usuarioId, nombre, email, rol };
    await registrarLog(usuarioId, 'registro', { email });

    res.status(201).json({ token: generarToken(usuario), usuario });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error al registrar el usuario.' });
  }
});

router.post('/login', async (req, res) => {
  if (!estado.dbConnected) return sinDB(res);

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos: email y password son obligatorios.' });
  }

  try {
    const [filas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (filas.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const usuarioDB = filas[0];
    const coincide = await bcrypt.compare(password, usuarioDB.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const usuario = { id: usuarioDB.id, nombre: usuarioDB.nombre, email: usuarioDB.email, rol: usuarioDB.rol };
    await registrarLog(usuario.id, 'login', { email });

    res.json({ token: generarToken(usuario), usuario });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

router.get('/me', verificarToken, (req, res) => {
  res.json({ usuario: req.usuario });
});

export default router;
