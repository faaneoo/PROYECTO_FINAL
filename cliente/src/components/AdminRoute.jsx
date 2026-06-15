import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { usuario, cargando } = useAuth();

  if (cargando) return null;
  if (usuario?.rol !== 'admin') return <Navigate to="/" replace />;

  return <Outlet />;
}
