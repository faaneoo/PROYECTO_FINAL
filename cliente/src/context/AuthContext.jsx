import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(() => {
    const guardado = localStorage.getItem('usuario');
    return guardado ? JSON.parse(guardado) : null;
  });
  const [cargando, setCargando] = useState(() => !!localStorage.getItem('token'));

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/auth/me', { token })
      .then(({ usuario }) => {
        setUsuario(usuario);
        localStorage.setItem('usuario', JSON.stringify(usuario));
      })
      .catch(() => {
        setToken(null);
        setUsuario(null);
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
      })
      .finally(() => setCargando(false));
  }, [token]);

  const guardarSesion = useCallback((datos) => {
    setToken(datos.token);
    setUsuario(datos.usuario);
    localStorage.setItem('token', datos.token);
    localStorage.setItem('usuario', JSON.stringify(datos.usuario));
  }, []);

  const login = useCallback(async (email, password) => {
    const datos = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    guardarSesion(datos);
  }, [guardarSesion]);

  const registro = useCallback(async (nombre, email, password) => {
    const datos = await apiFetch('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    });
    guardarSesion(datos);
  }, [guardarSesion]);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, token, cargando, login, registro, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return contexto;
}
