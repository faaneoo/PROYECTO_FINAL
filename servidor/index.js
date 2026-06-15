import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDB } from './db.js';
import { configurarSocket } from './socket/index.js';
import authRoutes from './routes/auth.routes.js';
import salasRoutes from './routes/salas.routes.js';
import crearAdminRouter from './routes/admin.routes.js';

const PORT = process.env.PORT || 3001;
// Admite uno o varios orígenes separados por comas, p.ej. "https://mi-app.vercel.app,http://localhost:5173"
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '*').split(',').map(o => o.trim());
const corsOptions = CORS_ORIGIN.length === 1 ? CORS_ORIGIN[0] : CORS_ORIGIN;

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está definido. Define esta variable de entorno antes de usar la app en producción.');
}

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

app.use('/api/auth', authRoutes);
app.use('/api/salas', salasRoutes);
app.use('/api/admin', crearAdminRouter(io));

configurarSocket(io);
initDB();

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
