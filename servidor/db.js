import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3307,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const DB_NAME = process.env.DB_NAME || 'pizarra_db';

export const pool = mysql.createPool({ ...DB_CONFIG, database: DB_NAME });

// Estado mutable compartido: indica si la BBDD está disponible
export const estado = { dbConnected: false };

// Inicializa la base de datos: crea el esquema y siembra la sala pública 'general'
export async function initDB() {
  try {
    const connection = await mysql.createConnection(DB_CONFIG);
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME}`);
    await connection.end();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        rol ENUM('usuario', 'admin') NOT NULL DEFAULT 'usuario',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        privada BOOLEAN NOT NULL DEFAULT TRUE,
        propietario_id INT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (propietario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS salas_miembros (
        sala_id INT NOT NULL,
        usuario_id INT NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (sala_id, usuario_id),
        FOREIGN KEY (sala_id) REFERENCES salas(id) ON DELETE CASCADE,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS trazos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sala VARCHAR(50) NOT NULL,
        datos JSON NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NULL,
        accion VARCHAR(50) NOT NULL,
        detalles JSON NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `);

    // Sembrar la sala pública 'general' si no existe
    await pool.query(
      `INSERT INTO salas (nombre, codigo, privada, propietario_id)
       SELECT 'General', 'general', FALSE, NULL FROM DUAL
       WHERE NOT EXISTS (SELECT 1 FROM salas WHERE codigo = 'general')`
    );

    estado.dbConnected = true;
    console.log('✅ Base de datos MySQL inicializada correctamente.');
  } catch (err) {
    estado.dbConnected = false;
    console.warn('⚠️ No se ha podido conectar a MySQL. Algunas funciones (usuarios, salas, login, admin) no estarán disponibles. Los trazos funcionarán en Modo Memoria RAM.');
  }
}
