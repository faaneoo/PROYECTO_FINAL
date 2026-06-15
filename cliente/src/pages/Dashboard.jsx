import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../api';
import './Dashboard.css';

export default function Dashboard() {
  const { usuario, token, logout } = useAuth();
  const navigate = useNavigate();

  const [salas, setSalas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const [nombreNuevaSala, setNombreNuevaSala] = useState('');
  const [codigoUnirse, setCodigoUnirse] = useState('');

  const cargarSalas = async () => {
    try {
      const { salas } = await apiFetch('/api/salas/mias', { token });
      setSalas(salas);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarSalas();
  }, []);

  const crearSala = async (e) => {
    e.preventDefault();
    if (!nombreNuevaSala.trim()) return;
    setError('');
    try {
      const { sala } = await apiFetch('/api/salas', {
        method: 'POST',
        token,
        body: JSON.stringify({ nombre: nombreNuevaSala }),
      });
      setNombreNuevaSala('');
      navigate(`/pizarra/${sala.codigo}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const unirseSala = async (e) => {
    e.preventDefault();
    if (!codigoUnirse.trim()) return;
    setError('');
    try {
      const { sala } = await apiFetch('/api/salas/unirse', {
        method: 'POST',
        token,
        body: JSON.stringify({ codigo: codigoUnirse.trim() }),
      });
      setCodigoUnirse('');
      navigate(`/pizarra/${sala.codigo}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const cerrarSesion = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-contenedor">
      <div className="dashboard-cabecera">
        <h1>🎨 Pizarra Virtual <span>Hola, {usuario?.nombre}</span></h1>
        <div className="dashboard-acciones-cabecera">
          {usuario?.rol === 'admin' && (
            <Link to="/admin" className="btn-secundario">⚙️ Admin</Link>
          )}
          <button className="btn-secundario" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div className="dashboard-contenido">
        {error && <div className="mensaje-error">{error}</div>}

        <div className="dashboard-tarjeta">
          <h2>Salas públicas</h2>
          <div className="lista-salas">
            <Link to="/pizarra/general" className="sala-item">
              <span className="sala-nombre">General</span>
              <span className="sala-meta">Sala compartida</span>
            </Link>
          </div>
        </div>

        <div className="dashboard-tarjeta">
          <h2>Mis salas privadas</h2>
          {cargando ? (
            <p className="mensaje-vacio">Cargando...</p>
          ) : (
            <div className="lista-salas">
              {salas.filter(s => s.privada).length === 0 && (
                <p className="mensaje-vacio">Todavía no tienes salas privadas.</p>
              )}
              {salas.filter(s => s.privada).map((sala) => (
                <Link key={sala.codigo} to={`/pizarra/${sala.codigo}`} className="sala-item">
                  <span className="sala-nombre">{sala.nombre}</span>
                  <span className="sala-meta">
                    {sala.esPropietaria ? 'Propietario' : 'Invitado'} · código: {sala.codigo}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-tarjeta">
          <h2>Crear una nueva sala</h2>
          <form className="form-fila" onSubmit={crearSala}>
            <input
              type="text"
              placeholder="Nombre de la sala"
              value={nombreNuevaSala}
              onChange={(e) => setNombreNuevaSala(e.target.value)}
            />
            <button type="submit">Crear</button>
          </form>
        </div>

        <div className="dashboard-tarjeta">
          <h2>Unirse a una sala privada</h2>
          <form className="form-fila" onSubmit={unirseSala}>
            <input
              type="text"
              placeholder="Código de la sala"
              value={codigoUnirse}
              onChange={(e) => setCodigoUnirse(e.target.value)}
            />
            <button type="submit">Unirse</button>
          </form>
        </div>
      </div>
    </div>
  );
}
