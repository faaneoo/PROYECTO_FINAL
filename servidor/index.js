import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mysql from 'mysql2/promise';

const PORT = process.env.PORT || 3001;
// Admite uno o varios orígenes separados por comas, p.ej. "https://mi-app.vercel.app,http://localhost:5173"
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
const corsOptions = CORS_ORIGIN.length === 1 ? CORS_ORIGIN[0] : CORS_ORIGIN;

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'pizarra_db';

const app = express();
app.use(cors({ origin: corsOptions }));
app.use(express.json());

// Health check para servicios de hosting (Render, etc.)
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'pizarra-virtual-servidor' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOptions,
    methods: ['GET', 'POST']
  }
});

const db = mysql.createPool({ ...DB_CONFIG, database: DB_NAME });

let dbConnected = false;
let memoriaTrazos = {}; // Objeto para guardar trazos en RAM si no hay BBDD: { 'sala1': [trazo1, trazo2...], 'sala2': [...] }

// Inicializar BBDD
async function initDB() {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
    await connection.end();

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS trazos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sala VARCHAR(50) NOT NULL,
        datos JSON NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await db.query(createTableQuery);
    dbConnected = true;
    console.log('✅ Base de datos MySQL inicializada correctamente.');
  } catch (err) {
    dbConnected = false;
    console.warn('⚠️ No se ha podido conectar a MySQL. Iniciando en Modo Memoria RAM (Los datos se perderán al reiniciar el servidor).');
  }
}

initDB();

// Envía un trazo al destino emitiendo el evento adecuado según su tipo
function emitirTrazo(destino, trazo) {
  if (trazo.herramienta === 'fondo') {
    destino.emit('fondo_pizarra', trazo.fondo);
  } else {
    destino.emit('dibujar', trazo);
  }
}

// Obtiene el historial de trazos de una sala, desde BBDD o memoria RAM
async function obtenerHistorial(sala) {
  if (dbConnected) {
    const [rows] = await db.query('SELECT datos FROM trazos WHERE sala = ? ORDER BY id ASC', [sala]);
    return rows.map(row => typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos);
  }
  return memoriaTrazos[sala] || [];
}

// Guarda un trazo en BBDD o memoria RAM
async function guardarTrazo(sala, trazo) {
  if (dbConnected) {
    await db.query('INSERT INTO trazos (sala, datos) VALUES (?, ?)', [sala, JSON.stringify(trazo)]);
  } else {
    if (!memoriaTrazos[sala]) {
      memoriaTrazos[sala] = [];
    }
    memoriaTrazos[sala].push(trazo);
  }
}

io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Unirse a una sala
  socket.on('unirse_sala', async (sala) => {
    socket.join(sala);
    console.log(`Usuario ${socket.id} se unió a la sala: ${sala}`);

    try {
      const historial = await obtenerHistorial(sala);
      historial.forEach(trazo => emitirTrazo(socket, trazo));
    } catch (error) {
      console.error('Error cargando historial de la base de datos:', error);
    }
  });

  // Recibir trazo y retransmitir a la sala
  socket.on('dibujar', async (data) => {
    // data = { sala: 'x', trazo: {...} }
    socket.to(data.sala).emit('dibujar', data.trazo);

    try {
      await guardarTrazo(data.sala, data.trazo);
    } catch (error) {
      console.error('Error guardando trazo en base de datos:', error);
    }
  });

  // Recibir fondo (PDF) y retransmitir a la sala
  socket.on('fondo_pizarra', async (data) => {
    socket.to(data.sala).emit('fondo_pizarra', data.fondo);

    const trazoFondo = {
      herramienta: 'fondo',
      fondo: data.fondo
    };

    try {
      await guardarTrazo(data.sala, trazoFondo);
    } catch (error) {
      console.error('Error guardando fondo en base de datos:', error);
    }
  });

  // Deshacer el último trazo
  socket.on('deshacer_ultimo', async (sala) => {
    try {
      if (dbConnected) {
        const [rows] = await db.query('SELECT id FROM trazos WHERE sala = ? ORDER BY id DESC LIMIT 1', [sala]);
        if (rows.length > 0) {
          await db.query('DELETE FROM trazos WHERE id = ?', [rows[0].id]);
        }
      } else if (memoriaTrazos[sala] && memoriaTrazos[sala].length > 0) {
        memoriaTrazos[sala].pop();
      } else {
        return;
      }

      io.in(sala).emit('limpiar_lienzo');
      const historial = await obtenerHistorial(sala);
      historial.forEach(trazo => emitirTrazo(io.in(sala), trazo));
    } catch (error) {
      console.error('Error deshaciendo trazo:', error);
    }
  });

  // Limpiar lienzo
  socket.on('limpiar_lienzo', async (sala) => {
    socket.to(sala).emit('limpiar_lienzo');

    try {
      if (dbConnected) {
        await db.query('DELETE FROM trazos WHERE sala = ?', [sala]);
      } else if (memoriaTrazos[sala]) {
        memoriaTrazos[sala] = [];
      }
    } catch (error) {
      console.error('Error borrando trazos de la base de datos:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
