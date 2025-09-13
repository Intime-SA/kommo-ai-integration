# API de Logs - Kommo Integration

## Descripción General

La API de Logs proporciona un endpoint consolidado para consultar datos de logs desde múltiples colecciones de MongoDB. Permite filtrar, paginar y ordenar logs de diferentes tipos para facilitar el monitoreo y análisis del sistema.

## Endpoint Principal

```
GET /api/logs
```

## Tipos de Logs

La API soporta 3 tipos principales de logs:

### 1. `received_messages`
Logs de mensajes entrantes de usuarios.

**Campos específicos:**
- `messageText`: Texto del mensaje
- `messageType`: 'incoming' | 'outgoing'
- `authorName`: Nombre del autor
- `messageId`: ID único del mensaje
- `chatId`: ID del chat

### 2. `change_status`
Logs de cambios de status realizados por el bot.

**Campos específicos:**
- `oldStatus`: Status anterior (opcional)
- `newStatus`: Status nuevo
- `changedBy`: 'bot' | 'manual' | 'system'
- `reason`: Razón del cambio
- `confidence`: Nivel de confianza (0-1)
- `success`: Si el cambio fue exitoso

### 3. `bot_actions`
Logs de acciones completas del bot incluyendo decisiones de IA.

**Campos específicos:**
- `messageText`: Texto del mensaje que activó la acción
- `aiDecision`: Decisión completa de la IA
- `statusUpdateResult`: Resultado de la actualización del status
- `processingTime`: Tiempo de procesamiento en ms

## Campos Comunes

Todos los logs incluyen estos campos base:

- `id`: ID único del log
- `timestamp`: Fecha y hora del evento
- `type`: Tipo de log
- `contactId`: ID del contacto
- `leadId`: ID del lead (opcional)
- `talkId`: ID de la conversación (opcional)
- `userName`: Nombre del usuario
- `clientId`: ID del cliente
- `sourceName`: Nombre de la fuente/origen

## Parámetros de Consulta

### Filtros de Fecha
- `startDate`: Fecha de inicio (ISO string)
- `endDate`: Fecha de fin (ISO string)

### Filtros de Tipo y Contenido
- `logType`: Tipo específico de log ('received_messages', 'change_status', 'bot_actions')
- `contactId`: Filtrar por ID de contacto
- `leadId`: Filtrar por ID de lead
- `talkId`: Filtrar por ID de conversación
- `userName`: Filtrar por nombre de usuario (búsqueda parcial)
- `clientId`: Filtrar por ID de cliente
- `sourceName`: Filtrar por nombre de fuente
- `status`: Filtrar por status (para logs de cambios)
- `changedBy`: Filtrar por quién realizó el cambio ('bot', 'manual', 'system')

### Paginación
- `limit`: Número de registros por página (1-1000, default: 50)
- `offset`: Desplazamiento para paginación (default: 0)

### Ordenamiento
- `sortBy`: Campo para ordenar ('timestamp', 'userName', 'contactId', 'type')
- `sortOrder`: Dirección del orden ('asc', 'desc')

## Ejemplos de Uso

### Consulta básica (últimos 50 logs)
```bash
GET /api/logs
```

### Filtrar por tipo de log
```bash
GET /api/logs?logType=received_messages
```

### Filtrar por fecha y usuario
```bash
GET /api/logs?startDate=2025-09-13T00:00:00Z&endDate=2025-09-13T23:59:59Z&userName=Ramiro
```

### Filtrar por contacto con paginación
```bash
GET /api/logs?contactId=9382110&limit=20&offset=0
```

### Cambios de status del bot ordenados por fecha descendente
```bash
GET /api/logs?logType=change_status&changedBy=bot&sortBy=timestamp&sortOrder=desc
```

### Logs de acciones del bot con búsqueda por texto
```bash
GET /api/logs?logType=bot_actions&userName=usuario
```

## Respuesta

### Respuesta Exitosa (200)
```json
{
  "logs": [
    {
      "id": "650f1e5c8b2c4a0012345678",
      "timestamp": "2025-09-13T11:21:53.000Z",
      "type": "received_messages",
      "contactId": "9382110",
      "leadId": "11332698",
      "talkId": "127",
      "userName": "Ramiro Arce",
      "clientId": "5492234666801",
      "sourceName": "1) Storm Internet Services",
      "messageText": "holis",
      "messageType": "incoming",
      "authorName": "Ramiro Arce",
      "messageId": "53e04cee-5229-4bff-ac7e-df90b31dc214",
      "chatId": "285ccd27-0db5-44e3-88ab-3270a7f4e4fa"
    }
  ],
  "total": 150,
  "limit": 50,
  "offset": 0,
  "hasMore": true,
  "query": {
    "logType": "received_messages",
    "limit": 50,
    "offset": 0
  }
}
```

### Headers de Respuesta
- `X-Total-Count`: Número total de registros encontrados
- `X-Has-More`: Indica si hay más páginas disponibles
- `X-Response-Time`: Tiempo de respuesta en ms

## Códigos de Error

### 400 Bad Request
Parámetros inválidos o formato incorrecto.

```json
{
  "error": "startDate debe ser una fecha válida"
}
```

### 500 Internal Server Error
Error interno del servidor.

```json
{
  "error": "Error interno del servidor"
}
```

## Consideraciones de Rendimiento

1. **Índices Recomendados**: Considera crear índices en campos frecuentemente filtrados:
   - `createdAt` en todas las colecciones
   - `contactId`, `leadId`, `talkId` según uso
   - `type` para filtrado por tipo de log

2. **Límites de Paginación**: El límite máximo es 1000 registros por consulta.

3. **Búsqueda de Texto**: La búsqueda por `userName` usa expresiones regulares, considera optimizar para búsquedas grandes.

4. **Consultas Combinadas**: Cuando no se especifica `logType`, se consultan todas las colecciones y se combinan los resultados.

## Logging y Monitoreo

El endpoint registra automáticamente:
- Todas las peticiones entrantes
- Respuestas exitosas con estadísticas
- Errores con contexto completo
- Tiempos de respuesta

Los logs se almacenan usando el sistema de logging existente del proyecto.
