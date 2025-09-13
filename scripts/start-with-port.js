#!/usr/bin/env node

/**
 * Script para iniciar el servidor en un puerto específico
 * Uso: node scripts/start-with-port.js [puerto]
 *
 * Ejemplos:
 * node scripts/start-with-port.js 3001
 * node scripts/start-with-port.js 4000
 * node scripts/start-with-port.js 8080
 */

const { spawn } = require('child_process');
const path = require('path');

const port = process.argv[2] || '3001';

console.log(`🚀 Iniciando servidor en puerto ${port}...`);
console.log(`📡 Backend API disponible en: http://localhost:${port}`);
console.log(`🔗 Frontend esperado en: http://localhost:3000`);
console.log(`📋 API Logs disponible en: http://localhost:${port}/api/logs`);
console.log('');

const env = {
  ...process.env,
  PORT: port,
  CORS_ORIGIN: 'http://localhost:3000',
};

const nextProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env,
  cwd: path.join(__dirname, '..'),
});

nextProcess.on('error', (error) => {
  console.error('❌ Error al iniciar el servidor:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo servidor...');
  nextProcess.kill('SIGINT');
  process.exit(0);
});
