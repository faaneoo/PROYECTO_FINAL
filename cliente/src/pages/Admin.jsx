import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import './Dashboard.css';
import './Admin.css';

const TABS = [
  { id: 'usuarios', etiqueta: 'Usuarios' },
  { id: 'salas', etiqueta: 'Salas' },
  { id: 'logs', etiqueta: 'Actividad' },
];

export default function Admin() {
  const { token } = useAuth();
  const [tab, setTab] = useState('usuarios');

  const [usuarios, setUsuarios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');

  const cargarUsuarios = async () => {
    try {
      const { usuarios } = await apiFetch('/api/admin/usuarios', { token });
      setUsuarios(usuarios);
    } catch (err) {
      setError(err.message);
    }
  };

  const cargarSalas = async () => {
    try {
      const { salas } = await apiFetch('/api/admin/salas', { token });
      setSalas(salas);
    } catch (err) {
      setError(err.message);
    }
  };

  const cargarLogs = async () => {
    try {
      const { logs } = await apiFetch('/api/admin/logs', { token });
      setLogs(logs);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError('');
    if (tab === 'usuarios') cargarUsuarios();
    if (tab === 'salas') cargarSalas();
    if (tab === 'logs') cargarLogs();
  }, [tab]);

  const cambiarRol = async (id, rol) => {
    setError('');
    try {
      await apiFetch(`/api/admin/usuarios/${id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ rol }),
      });
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    setError('');
    try {
      await apiFetch(`/api/admin/usuarios/${id}`, { method: 'DELETE', token });
      cargarUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  const vaciarSala = async (codigo) => {
    if (!confirm(`¿Vaciar todos los trazos de la sala "${codigo}"?`)) return;
    setError('');
    try {
      await apiFetch(`/api/admin/salas/${codigo}/trazos`, { method: 'DELETE', token });
      cargarSalas();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-contenedor">
      <div className="admin-cabecera">
        <h1>⚙️ Panel de Administración</h1>
        <Link to="/" className="btn-secundario">⬅️ Volver al panel</Link>
      </div>

      <div className="admin-contenido">
        {error && <div className="mensaje-error">{error}</div>}

        <div className="admin-tabs">
          {TABS.map(({ id, etiqueta }) => (
            <button
              key={id}
              className={tab === id ? 'admin-tab activo' : 'admin-tab'}
              onClick={() => setTab(id)}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {tab === 'usuarios' && (
          <div className="admin-tarjeta">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Registrado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nombre}</td>
                    <td>{u.email}</td>
                    <td>
                      <select value={u.rol} onChange={(e) => cambiarRol(u.id, e.target.value)}>
                        <option value="usuario">usuario</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td>{new Date(u.fecha_creacion).toLocaleString()}</td>
                    <td>
                      <button className="admin-accion" onClick={() => eliminarUsuario(u.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'salas' && (
          <div className="admin-tarjeta">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Tipo</th>
                  <th>Propietario</th>
                  <th>Trazos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {salas.map((s) => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td>{s.codigo}</td>
                    <td>{s.privada ? 'Privada' : 'Pública'}</td>
                    <td>{s.propietario || '—'}</td>
                    <td>{s.num_trazos}</td>
                    <td>
                      <button className="admin-accion secundaria" onClick={() => vaciarSala(s.codigo)}>Vaciar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'logs' && (
          <div className="admin-tarjeta">
            <table className="admin-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.fecha).toLocaleString()}</td>
                    <td>{l.usuario || '—'}</td>
                    <td>{l.accion}</td>
                    <td>{l.detalles ? JSON.stringify(l.detalles) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
