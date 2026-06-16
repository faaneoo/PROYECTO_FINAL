import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
  const { usuario, token, cargando } = useAuth();

  if (cargando) return <div className="pantalla-carga">Cargando...</div>;
  if (!token || !usuario) return <Navigate to="/login" replace />;

  return <Outlet />;
}
