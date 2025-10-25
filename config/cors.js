// Configuración CORS para desarrollo
const corsConfig = {
  // URLs permitidas para CORS
  allowedOrigins: [
    // kommo.paybot.app
    'https://kommo.paybot.app',
  
    // landings redirects token/campaigns
    'https://guba-redirect-qhwv.vercel.app', // money maker
    'https://redirect-hernan-2.vercel.app',
    'https://redirect-tee-1.vercel.app',
    'https://guba-redirect.vercel.app', // guba redirect
  /*'http://localhost:3000',  // Frontend típico
    'http://127.0.0.1:3000', // Frontend alternativo
    'http://localhost:3001', // Si el backend está en 3001
    'http://127.0.0.1:3001',
    'http://localhost:3002', // Si el backend está en 3002
    'http://127.0.0.1:3002',
    'http://localhost:4000', // Otro puerto común
    'http://localhost:8080', // Otro puerto común */
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
