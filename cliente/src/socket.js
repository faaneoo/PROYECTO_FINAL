import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Crea una conexión de Socket.io autenticada con el JWT del usuario
export function crearSocket(token) {
  return io(SOCKET_URL, {
    auth: { token },
    autoConnect: true,
  });
}
