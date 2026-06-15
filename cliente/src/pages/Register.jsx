import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Register() {
  const { registro } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await registro(nombre, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="auth-contenedor">
      <form className="auth-tarjeta" onSubmit={enviar}>
        <h1>🎨 Pizarra Virtual</h1>
        <p className="auth-subtitulo">Crea tu cuenta</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="name" />
        </div>

        <div className="auth-campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </div>

        <div className="auth-campo">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        </div>

        <button className="auth-boton" type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta...' : 'Registrarse'}
        </button>

        <p className="auth-enlace">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </form>
    </div>
  );
}
