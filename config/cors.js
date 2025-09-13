// Configuración CORS para desarrollo
const corsConfig = {
  // URLs permitidas para CORS
  allowedOrigins: [
    'https://kommo-ai-dashboard.vercel.app',
    'https://kommo-ai-dashboard.vercel.app/',
    'http://localhost:3000',  // Frontend típico
    'http://127.0.0.1:3000', // Frontend alternativo
    'http://localhost:3001', // Si el backend está en 3001
    'http://127.0.0.1:3001',
  ],

  // Métodos HTTP permitidos
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],

  // Headers permitidos
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],

  // Si permitir credenciales
  credentials: true,

  // Tiempo de cache para preflight requests (en segundos)
  maxAge: 86400, // 24 horas
};

module.exports = corsConfig;
