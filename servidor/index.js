import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mysql from 'mysql2/promise';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const db = mysql.createPool({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: '',
  database: 'pizarra_db'
});

let dbConnected = false;
let memoriaTrazos = {}; // Objeto para guardar trazos en RAM si no hay BBDD: { 'sala1': [trazo1, trazo2...], 'sala2': [...] }

// Inicializar BBDD
async function initDB() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3307,
      user: 'root',
      password: ''
    });
    await connection.query('CREATE DATABASE IF NOT EXISTS pizarra_db');
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

io.on('connection', (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  // Unirse a una sala
  socket.on('unirse_sala', async (sala) => {
    socket.join(sala);
    console.log(`Usuario ${socket.id} se unió a la sala: ${sala}`);

    if (dbConnected) {
      try {
        const [rows] = await db.query('SELECT datos FROM trazos WHERE sala = ? ORDER BY id ASC', [sala]);
        rows.forEach(row => {
          const trazo = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos;
          if (trazo.herramienta === 'fondo') {
            socket.emit('fondo_pizarra', trazo.fondo);
          } else {
            socket.emit('dibujar', trazo);
          }
        });
      } catch (error) {
        console.error('Error cargando historial de la base de datos:', error);
      }
    } else if (memoriaTrazos[sala]) {
      // Si tenemos trazos en memoria RAM, se los enviamos al usuario nuevo
      memoriaTrazos[sala].forEach(trazo => {
        if (trazo.herramienta === 'fondo') {
          socket.emit('fondo_pizarra', trazo.fondo);
        } else {
          socket.emit('dibujar', trazo);
        }
      });
    }
  });

  // Recibir trazo y retransmitir a la sala
  socket.on('dibujar', async (data) => {
    // data = { sala: 'x', trazo: {...} }
    socket.to(data.sala).emit('dibujar', data.trazo);

    if (dbConnected) {
      try {
        await db.query('INSERT INTO trazos (sala, datos) VALUES (?, ?)', [data.sala, JSON.stringify(data.trazo)]);
      } catch (error) {
        console.error('Error guardando trazo en base de datos:', error);
      }
    } else {
      // Guardar en memoria RAM si MySQL no está disponible
      if (!memoriaTrazos[data.sala]) {
        memoriaTrazos[data.sala] = [];
      }
      memoriaTrazos[data.sala].push(data.trazo);
    }
  });

  // Recibir fondo (PDF) y retransmitir a la sala
  socket.on('fondo_pizarra', async (data) => {
    socket.to(data.sala).emit('fondo_pizarra', data.fondo);

    const trazoFondo = {
      herramienta: 'fondo',
      fondo: data.fondo
    };

    if (dbConnected) {
      try {
        await db.query('INSERT INTO trazos (sala, datos) VALUES (?, ?)', [data.sala, JSON.stringify(trazoFondo)]);
      } catch (error) {
        console.error('Error guardando fondo en base de datos:', error);
      }
    } else {
      if (!memoriaTrazos[data.sala]) {
        memoriaTrazos[data.sala] = [];
      }
      memoriaTrazos[data.sala].push(trazoFondo);
    }
  });

  // Deshacer el último trazo
  socket.on('deshacer_ultimo', async (sala) => {
    if (dbConnected) {
      try {
        const [rows] = await db.query('SELECT id FROM trazos WHERE sala = ? ORDER BY id DESC LIMIT 1', [sala]);
        if (rows.length > 0) {
          await db.query('DELETE FROM trazos WHERE id = ?', [rows[0].id]);
        }
        
        io.in(sala).emit('limpiar_lienzo');
        const [allRows] = await db.query('SELECT datos FROM trazos WHERE sala = ? ORDER BY id ASC', [sala]);
        allRows.forEach(row => {
          const trazo = typeof row.datos === 'string' ? JSON.parse(row.datos) : row.datos;
          if (trazo.herramienta === 'fondo') {
            io.in(sala).emit('fondo_pizarra', trazo.fondo);
          } else {
            io.in(sala).emit('dibujar', trazo);
          }
        });
      } catch (error) {
        console.error('Error deshaciendo trazo:', error);
      }
    } else {
      if (memoriaTrazos[sala] && memoriaTrazos[sala].length > 0) {
        memoriaTrazos[sala].pop();
        io.in(sala).emit('limpiar_lienzo');
        memoriaTrazos[sala].forEach(trazo => {
          if (trazo.herramienta === 'fondo') {
            io.in(sala).emit('fondo_pizarra', trazo.fondo);
          } else {
            io.in(sala).emit('dibujar', trazo);
          }
        });
      }
    }
  });

  // Limpiar lienzo
  socket.on('limpiar_lienzo', async (sala) => {
    socket.to(sala).emit('limpiar_lienzo');
    
    if (dbConnected) {
      try {
        await db.query('DELETE FROM trazos WHERE sala = ?', [sala]);
      } catch (error) {
        console.error('Error borrando trazos de la base de datos:', error);
      }
    }
    
    if (!dbConnected && memoriaTrazos[sala]) {
      memoriaTrazos[sala] = [];
    }
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
