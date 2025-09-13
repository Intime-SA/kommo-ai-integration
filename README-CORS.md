# 🔧 Solución CORS y Configuración de Puertos

## Problema CORS Resuelto ✅

Si tienes tu **frontend** corriendo en `localhost:3000` y tu **backend** en `localhost:3001`, ya no tendrás problemas de CORS. Hemos configurado:

- ✅ **Headers CORS** automáticos para todas las rutas `/api/*`
- ✅ **Middleware** que maneja preflight requests (OPTIONS)
- ✅ **Configuración automática** de URLs en el servicio frontend
- ✅ **Múltiples orígenes permitidos** para desarrollo flexible

## 🚀 Inicio Rápido

### Opción 1: Usar scripts pre-configurados

```bash
# Backend en puerto 3001 (recomendado)
npm run dev:3001

# O en otros puertos
npm run dev:4000
npm run dev:8080
```

### Opción 2: Configuración manual

```bash
# Puerto personalizado
node scripts/start-with-port.js 3001

# Puerto por defecto (3000)
npm run dev
```

## 📋 Configuración Actual

### Frontend esperado en:
- `http://localhost:3000`
- `http://127.0.0.1:3000`

### Backend configurado para:
- `http://localhost:3001` (recomendado)
- `http://localhost:4000`
- `http://localhost:8080`

## 🔧 Archivos Modificados

### 1. `next.config.mjs`
```javascript
// Configuración CORS en headers
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: 'http://localhost:3000',
        },
        // ... más headers
      ],
    },
  ];
}
```

### 2. `middleware.ts`
```typescript
// Middleware para manejar CORS dinámicamente
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:4000',
  'http://localhost:8080',
];
```

### 3. `service/logs.ts`
```typescript
// Configuración automática de URLs
if (isDevelopment) {
  const backendPort = window.location.port === '3000' ? '3001' : window.location.port;
  this.baseUrl = `http://localhost:${backendPort}/api/logs`;
}
```

## 🧪 Probar la Configuración

### 1. Iniciar Backend
```bash
npm run dev:3001
```

### 2. Verificar CORS
```bash
# Desde otro terminal
curl -X GET "http://localhost:3001/api/logs" \
  -H "Origin: http://localhost:3000" \
  -v
```

Deberías ver en la respuesta:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
```

### 3. Probar desde Frontend
```javascript
// En tu frontend (localhost:3000)
import { getLogsLast24Hours } from './service/logs';

const logs = await getLogsLast24Hours();
console.log(logs); // ✅ Sin errores CORS
```

## 🔄 Cambiar Puertos

### Modificar puerto del backend:

```bash
# Puerto 4000
npm run dev:4000

# Puerto 8080
npm run dev:8080

# Puerto personalizado
node scripts/start-with-port.js 5000
```

### Actualizar configuración CORS:

Si necesitas agregar más orígenes permitidos, edita `middleware.ts`:

```typescript
const allowedOrigins = [
  'http://localhost:3000',  // Tu frontend
  'http://localhost:4000',  // Otro frontend
  'https://mi-app.vercel.app', // Producción
];
```

## 🐛 Solución de Problemas

### Error: "CORS policy violation"
```bash
# Verificar que el backend esté corriendo
curl http://localhost:3001/api/logs

# Verificar headers CORS
curl -H "Origin: http://localhost:3000" http://localhost:3001/api/logs -v
```

### Error: "Connection refused"
```bash
# Verificar que el puerto esté disponible
lsof -i :3001

# Cambiar a otro puerto
npm run dev:4000
```

### Error: "Failed to fetch"
```javascript
// En el frontend, verificar la URL
console.log('Service URL:', logsService.baseUrl);

// Forzar URL específica si es necesario
const customService = new LogsService('http://localhost:3001/api/logs');
```

## 📊 URLs de Acceso

### Desarrollo:
- **Backend API**: `http://localhost:3001`
- **API Logs**: `http://localhost:3001/api/logs`
- **Frontend**: `http://localhost:3000`

### Producción:
- Configurar variables de entorno para URLs de producción
- Actualizar `allowedOrigins` en `middleware.ts`

## 🔐 Configuración de Producción

Para producción en Vercel, asegúrate de:

1. **Configurar variables de entorno en Vercel**:
   - Ve a tu proyecto en Vercel Dashboard
   - Settings → Environment Variables
   - Agrega: `CORS_ORIGIN=https://kommo-ai-dashboard.vercel.app/`

2. **Verificar orígenes permitidos en middleware.ts**:
```typescript
const allowedOrigins = [
  'https://kommo-ai-dashboard.vercel.app/', // Con barra
  'https://kommo-ai-dashboard.vercel.app',  // Sin barra
  // ... otros orígenes
];
```

3. **El next.config.mjs ya está configurado** para usar `process.env.CORS_ORIGIN` automáticamente.

4. **Redeploy** tu aplicación en Vercel después de agregar las variables de entorno.

### 🚨 Solución Rápida para CORS en Producción

Si sigues teniendo problemas de CORS en producción:

1. **Verifica las variables de entorno en Vercel**
2. **Revisa los logs de Vercel** para errores de CORS
3. **Prueba con curl** desde tu servidor de producción:
```bash
curl -X OPTIONS "https://tu-app.vercel.app/api/logs" \
  -H "Origin: https://kommo-ai-dashboard.vercel.app/" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

## 🎯 Resumen

✅ **CORS configurado automáticamente**
✅ **Múltiples puertos soportados**
✅ **Configuración automática de URLs**
✅ **Middleware robusto**
✅ **Fácil cambio de puertos**

Ahora puedes desarrollar con frontend y backend separados sin problemas de CORS! 🎉
