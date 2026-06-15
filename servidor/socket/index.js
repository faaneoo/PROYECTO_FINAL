import jwt from 'jsonwebtoken';
import { pool, estado } from '../db.js';
import { emitirTrazo, obtenerHistorial, guardarTrazo, eliminarUltimoTrazo, vaciarSala } from '../trazos.js';
import { registrarLog } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Comprueba si un usuario tiene acceso a una sala (pública, propietario o miembro)
async function tieneAcceso(sala, usuarioId) {
  if (!sala.privada) return true;
  if (sala.propietario_id === usuarioId) return true;
  const [filas] = await pool.query(
    'SELECT 1 FROM salas_miembros WHERE sala_id = ? AND usuario_id = ?',
    [sala.id, usuarioId]
  );
  return filas.length > 0;
}

export function configurarSocket(io) {
  // Middleware de autenticación: exige un JWT válido para conectar
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('No autenticado'));
    }
    try {
      socket.usuario = jwt.verify(token, JWT_SECRET);
      next();
    } catch (error) {
      next(new Error('Token inválido o caducado'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Usuario conectado: ${socket.id} (${socket.usuario.email})`);

    // Unirse a una sala
    socket.on('unirse_sala', async (codigo) => {
      try {
        if (!estado.dbConnected) {
          // Sin BBDD no podemos comprobar permisos de salas privadas; solo se permite la sala pública
          if (codigo !== 'general') {
            return socket.emit('acceso_denegado');
          }
        } else {
          const [filas] = await pool.query('SELECT * FROM salas WHERE codigo = ?', [codigo]);
          if (filas.length === 0 || !(await tieneAcceso(filas[0], socket.usuario.id))) {
            await registrarLog(socket.usuario.id, 'acceso_denegado', { sala: codigo });
            return socket.emit('acceso_denegado');
          }
        }

        socket.join(codigo);
        console.log(`Usuario ${socket.id} se unió a la sala: ${codigo}`);

        const historial = await obtenerHistorial(codigo);
        historial.forEach(trazo => emitirTrazo(socket, trazo));
      } catch (error) {
        console.error('Error al unirse a la sala:', error);
        socket.emit('acceso_denegado');
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
        const habiaTrazo = await eliminarUltimoTrazo(sala);
        if (!habiaTrazo) return;

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
        await vaciarSala(sala);
        await registrarLog(socket.usuario.id, 'limpiar_lienzo', { sala });
      } catch (error) {
        console.error('Error borrando trazos de la base de datos:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Usuario desconectado: ${socket.id}`);
    });
  });
}
