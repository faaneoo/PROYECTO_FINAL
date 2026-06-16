import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { useAuth } from '../context/AuthContext';
import { crearSocket } from '../socket';
import '../App.css';

// Configurar worker de PDF.js usando CDN (versión 3.x usa .js)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function Pizarra() {
  const { codigo: sala } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const bgImageRef = useRef(null); // Guardar imagen de fondo (PDF)

  const [dibujando, setDibujando] = useState(false);
  const [color, setColor] = useState('#000000');
  const [grosor, setGrosor] = useState(3);
  const [herramienta, setHerramienta] = useState('lapiz'); // lapiz, linea, rectangulo, circulo

  const snapshotRef = useRef(null); // Foto del canvas para hacer "preview" de las formas
  const posRef = useRef({ x: 0, y: 0 }); // Posición inicial al hacer click

  useEffect(() => {
    const socket = crearSocket(token);
    socketRef.current = socket;

    socket.emit('unirse_sala', sala);

    socket.on('dibujar', (trazo) => {
      dibujarTrazo(trazo, false);
    });

    socket.on('limpiar_lienzo', () => {
       limpiarCanvasLocal();
    });

    socket.on('fondo_pizarra', (dataURL) => {
      cargarFondoLocal(dataURL);
    });

    socket.on('acceso_denegado', () => {
      alert('No tienes acceso a esta sala.');
      navigate('/');
    });

    socket.on('connect_error', (err) => {
      if (err.message === 'Token inválido o caducado' || err.message === 'No autenticado') {
        alert('Tu sesión ha expirado. Vuelve a iniciar sesión.');
        navigate('/login');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [sala]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !contextRef.current) {
      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';

      // Rellenar de blanco para que no salga negro al descargar
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      contextRef.current = context;
    }
  }, []);

  // Atajo de teclado para Deshacer (Ctrl + Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault(); // Evitar comportamiento por defecto del navegador
        deshacer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sala]);

  const obtenerPosicion = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const punto = e.touches?.[0] ?? e.changedTouches?.[0] ?? e;
    return {
      x: (punto.clientX - rect.left) * scaleX,
      y: (punto.clientY - rect.top) * scaleY
    };
  };

  const empezarDibujo = (e) => {
    setDibujando(true);
    posRef.current = obtenerPosicion(e);
    // Guardar una foto del lienzo actual para la vista previa
    snapshotRef.current = contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const pararDibujo = (e) => {
    if (!dibujando) return;
    setDibujando(false);

    // Si estábamos dibujando una forma geométrica, emitimos el trazo final al soltar
    if (herramienta !== 'lapiz') {
      const posFinal = obtenerPosicion(e);
      const trazoFinal = {
        herramienta,
        x0: posRef.current.x,
        y0: posRef.current.y,
        x1: posFinal.x,
        y1: posFinal.y,
        color,
        grosor
      };

      socketRef.current.emit('dibujar', { sala, trazo: trazoFinal });
    }
  };

  const dibujar = (e) => {
    if (!dibujando) return;

    const nuevaPos = obtenerPosicion(e);

    if (herramienta === 'lapiz') {
      const trazo = {
        herramienta: 'lapiz',
        x0: posRef.current.x,
        y0: posRef.current.y,
        x1: nuevaPos.x,
        y1: nuevaPos.y,
        color,
        grosor
      };
      dibujarTrazo(trazo, true);
      posRef.current = nuevaPos;
    } else {
      // Restauramos la imagen anterior antes de dibujar la preview
      contextRef.current.putImageData(snapshotRef.current, 0, 0);

      const trazoPreview = {
        herramienta,
        x0: posRef.current.x,
        y0: posRef.current.y,
        x1: nuevaPos.x,
        y1: nuevaPos.y,
        color,
        grosor
      };
      dibujarTrazo(trazoPreview, false);
    }
  };

  function dibujarTrazo(trazo, emitir) {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = trazo.color;
    ctx.lineWidth = trazo.grosor;

    if (trazo.herramienta === 'lapiz' || trazo.herramienta === 'linea') {
      ctx.moveTo(trazo.x0, trazo.y0);
      ctx.lineTo(trazo.x1, trazo.y1);
      ctx.stroke();
    } else if (trazo.herramienta === 'rectangulo') {
      ctx.rect(trazo.x0, trazo.y0, trazo.x1 - trazo.x0, trazo.y1 - trazo.y0);
      ctx.stroke();
    } else if (trazo.herramienta === 'circulo') {
      const radioX = Math.abs(trazo.x1 - trazo.x0);
      const radioY = Math.abs(trazo.y1 - trazo.y0);
      const radio = Math.max(radioX, radioY);
      ctx.arc(trazo.x0, trazo.y0, radio, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.closePath();

    if (emitir && trazo.herramienta === 'lapiz') {
      socketRef.current.emit('dibujar', { sala, trazo });
    }
  }

  function limpiarCanvasLocal() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    bgImageRef.current = null;
  }

  const limpiarLienzo = () => {
    limpiarCanvasLocal();
    socketRef.current.emit('limpiar_lienzo', sala);
  };

  function deshacer() {
    socketRef.current?.emit('deshacer_ultimo', sala);
  }

  const descargarImagen = () => {
    const canvas = canvasRef.current;
    const dataURL = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `pizarra_${sala}.png`;
    link.click();
  };

  function cargarFondoLocal(dataURL) {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const x = (canvas.width / 2) - (img.width / 2) * scale;
      const y = (canvas.height / 2) - (img.height / 2) * scale;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      bgImageRef.current = dataURL;
    };
    img.src = dataURL;
  }

  const subirPDF = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;

    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result);
      try {
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const page = await pdf.getPage(1); // Renderizamos la página 1
        const viewport = page.getViewport({ scale: 3.0 }); // Aumentada escala para mayor calidad
        const canvasTemp = document.createElement('canvas');
        const contextTemp = canvasTemp.getContext('2d');
        canvasTemp.height = viewport.height;
        canvasTemp.width = viewport.width;

        await page.render({ canvasContext: contextTemp, viewport }).promise;
        const dataURL = canvasTemp.toDataURL("image/png");

        cargarFondoLocal(dataURL);
        socketRef.current.emit('fondo_pizarra', { sala, fondo: dataURL });
      } catch (error) {
        console.error("Error leyendo PDF:", error);
        alert("Hubo un error al procesar el PDF.");
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  return (
    <div className="App">
      <aside className="barra-lateral">
        <h1 className="titulo-pizarra">Pizarra <span>({sala})</span></h1>

        <div className="barra-herramientas">
          <button className={herramienta === 'lapiz' ? 'btn-herramienta activo' : 'btn-herramienta'} onClick={() => setHerramienta('lapiz')}>✏️ Lápiz</button>
          <button className={herramienta === 'linea' ? 'btn-herramienta activo' : 'btn-herramienta'} onClick={() => setHerramienta('linea')}>📏 Línea</button>
          <button className={herramienta === 'rectangulo' ? 'btn-herramienta activo' : 'btn-herramienta'} onClick={() => setHerramienta('rectangulo')}>🔲 Rectángulo</button>
          <button className={herramienta === 'circulo' ? 'btn-herramienta activo' : 'btn-herramienta'} onClick={() => setHerramienta('circulo')}>⭕ Círculo</button>

          <div className="controles-color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Color" />
            <input type="range" min="1" max="50" value={grosor} onChange={(e) => setGrosor(parseInt(e.target.value))} title="Grosor" className="rango-grosor" />
          </div>

          <button onClick={() => { setHerramienta('lapiz'); setColor('#ffffff'); }} className="btn-herramienta goma" title="Goma">🧼 Goma de borrar</button>
        </div>

        <div className="controles-avanzados">
           <Link to="/" className="btn-herramienta">⬅️ Volver al panel</Link>
           <button onClick={deshacer} className="btn-herramienta" title="Deshacer último trazo (Ctrl+Z)">↩️ Deshacer</button>
           <label className="btn-herramienta subir-btn">
             📄 Subir PDF
             <input type="file" accept="application/pdf" onChange={subirPDF} style={{ display: 'none' }} />
           </label>
           <button onClick={descargarImagen} className="btn-herramienta">💾 Guardar PNG</button>
           <button onClick={limpiarLienzo} className="btn-limpiar">🗑️ Limpiar Lienzo</button>
        </div>
      </aside>

      <main className="contenedor-lienzo">
        <canvas
          ref={canvasRef}
          width={2000}
          height={1400}
          onMouseDown={empezarDibujo}
          onMouseUp={pararDibujo}
          onMouseOut={pararDibujo}
          onMouseMove={dibujar}
          onTouchStart={(e) => { e.preventDefault(); empezarDibujo(e); }}
          onTouchMove={(e) => { e.preventDefault(); dibujar(e); }}
          onTouchEnd={pararDibujo}
          className="lienzo"
          style={{ touchAction: 'none' }}
        />
      </main>
    </div>
  );
}
