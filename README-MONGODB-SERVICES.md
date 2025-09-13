# Servicios de MongoDB para Kommo AI Integration

Este documento describe los servicios implementados para interactuar con la base de datos MongoDB en el sistema de integración con Kommo.

## Colecciones

El sistema utiliza 5 colecciones principales en la base de datos `kommo`:

### 1. `users`
Almacena información de usuarios/clientes.

**Campos principales:**
- `clientId`: ID único del cliente (usado como identificador principal)
- `name`: Nombre del cliente
- `contactId`: ID de contacto en Kommo
- `source`: Origen del usuario
- `sourceUid`: UID del origen
- `sourceName`: Nombre del origen
- `messageText`: Texto del mensaje inicial
- `createdAt`: Fecha de creación (ISO string en horario Argentina)
- `updatedAt`: Fecha de última actualización (ISO string en horario Argentina)

### 2. `leads`
Almacena información de leads/prospectos.

**Campos principales:**
- `uid`: ID único del elemento no ordenado
- `leadId`: ID del lead en Kommo
- `contactId`: ID de contacto asociado
- `pipelineId`: ID del pipeline
- `client`: Información del cliente (name, id)
- `source`: Origen del lead
- `category`: Categoría
- `messageText`: Texto del mensaje
- `createdAt`: Fecha de creación (ISO string en horario Argentina)
- `updatedAt`: Fecha de actualización (ISO string en horario Argentina)

### 3. `tasks`
Almacena información de conversaciones/tareas.

**Campos principales:**
- `talkId`: ID único de la conversación
- `contactId`: ID de contacto
- `chatId`: ID del chat
- `entityId`: ID de la entidad (lead)
- `entityType`: Tipo de entidad
- `origin`: Origen de la conversación
- `isInWork`: Si está en trabajo
- `isRead`: Si está leído
- `createdAt`: Fecha de creación (ISO string en horario Argentina)
- `updatedAt`: Fecha de actualización (ISO string en horario Argentina)

### 4. `messages`
Almacena mensajes de conversaciones.

**Campos principales:**
- `id`: ID único del mensaje
- `talkId`: ID de la conversación
- `contactId`: ID de contacto
- `chatId`: ID del chat
- `text`: Contenido del mensaje
- `type`: Tipo de mensaje ("incoming" | "outgoing")
- `author`: Información del autor
- `createdAt`: Fecha de creación (ISO string en horario Argentina)
- `updatedAt`: Fecha de actualización (ISO string en horario Argentina)

### 5. `bot_actions`
Almacena el historial de acciones realizadas por el bot de IA en el procesamiento de mensajes.

**Campos principales:**
- `talkId`: ID de la conversación
- `entityId`: ID de la entidad (lead)
- `contactId`: ID de contacto
- `messageText`: Texto del mensaje procesado
- `messageCreatedAt`: Fecha de creación del mensaje (ISO string en horario Argentina)
- `aiDecision`: Decisión tomada por la IA
  - `currentStatus`: Status actual del lead
  - `newStatus`: Status propuesto por la IA
  - `shouldChange`: Si se debe cambiar el status
  - `reasoning`: Razón de la decisión
  - `confidence`: Nivel de confianza (0-1)
- `statusUpdateResult`: Resultado de la actualización del status
  - `success`: Si la actualización fue exitosa
  - `error`: Mensaje de error (si aplica)
- `processingTimestamp`: Fecha y hora del procesamiento (ISO string en horario Argentina)
- `createdAt`: Fecha de creación del registro (ISO string en horario Argentina)

## Servicios Implementados

### `createUser(data)`
Crea un nuevo usuario o actualiza uno existente.

**Parámetros:**
```typescript
{
  sourceUid: string;
  client: { name: string; id: string };
  createdAt: string;
  contactId: string;
  source: string;
  sourceName: string;
  messageText: string;
}
```

**Comportamiento:**
- Verifica si ya existe un usuario con el `client.id`
- Si existe, actualiza los datos
- Si no existe, crea uno nuevo

### `createLead(data)`
Crea un nuevo lead o actualiza uno existente.

**Parámetros:**
```typescript
{
  uid: string;
  source: string;
  sourceUid: string;
  category: string;
  leadId: string;
  contactId: string;
  pipelineId: string;
  createdAt: string;
  client: { name: string; id: string };
  messageText: string;
  sourceName: string;
}
```

### `createTask(data)`
Crea una nueva conversación o actualiza una existente.

**Parámetros:**
```typescript
{
  talkId: string;
  contactId: string;
  chatId: string;
  entityId: string;
  entityType: string;
  origin: string;
  isInWork: string;
  isRead: string;
  createdAt: string;
}
```

### `updateTask(data)`
Actualiza una conversación existente.

**Parámetros:**
```typescript
{
  talkId: string;
  contactId: string;
  chatId: string;
  entityId: string;
  entityType: string;
  origin: string;
  isInWork: string;
  isRead: string;
  updatedAt: string;
}
```

### `receiveMessage(data)`
Guarda un mensaje en la base de datos.

**Parámetros:**
```typescript
{
  id: string;
  chatId: string;
  talkId: string;
  contactId: string;
  text: string;
  createdAt: string;
  elementType: string;
  entityType: string;
  elementId: string;
  entityId: string;
  type: "incoming" | "outgoing";
  author: {
    id: string;
    type: string;
    name: string;
  };
}
```

### `createBotAction(data)`
Crea un registro de acción del bot en la colección `bot_actions`.

**Parámetros:**
```typescript
{
  talkId: string;
  entityId: string;
  contactId: string;
  messageText: string;
  messageCreatedAt: string | number;
  aiDecision: {
    currentStatus: string;
    newStatus: string;
    shouldChange: boolean;
    reasoning: string;
    confidence: number;
  };
  statusUpdateResult: {
    success: boolean;
    error?: string;
  };
}
```

**Comportamiento:**
- Crea un nuevo registro en la colección `bot_actions`
- Registra la decisión de IA y el resultado de la actualización del status
- Incluye timestamps en horario Argentina
- Siempre crea un nuevo registro (no actualiza existentes)

## Utilidades de Fecha

### `convertToArgentinaISO(dateString: string)`
Convierte una fecha al formato ISO string en horario Argentina (UTC-3).

**Formatos de entrada soportados:**
- `"12/9/2025, 21:03:38"` (formato Kommo)
- Otros formatos de fecha estándar

### `getCurrentArgentinaISO()`
Retorna la fecha y hora actual en formato ISO string en horario Argentina.

## Integración con Webhooks

Los servicios están integrados en el endpoint `/api/webhook-kommo/route.ts` y procesan automáticamente los diferentes tipos de webhooks:

1. **Unsorted Add**: Crea usuario y lead
2. **Talk Add**: Crea conversación
3. **Talk Update**: Actualiza conversación
4. **Message Add**: Guarda mensaje, procesa con IA y registra acción del bot en `bot_actions`

## Configuración

Asegúrate de tener configurada la variable de entorno `MONGO_DB_URI` apuntando a tu base de datos MongoDB.

## Ejemplo de Uso

```typescript
import { createUser, createLead, createTask, updateTask, receiveMessage, createBotAction } from '@/lib/mongodb-services';

// Crear usuario
const user = await createUser({
  sourceUid: "amojo:waba:123",
  client: { name: "Juan Pérez", id: "549123456789" },
  createdAt: "12/9/2025, 21:03:38",
  contactId: "12345",
  source: "waba",
  sourceName: "Mi Empresa",
  messageText: "Hola"
});

// Crear lead
const lead = await createLead({
  uid: "abc123",
  source: "waba",
  sourceUid: "amojo:waba:123",
  category: "chats",
  leadId: "67890",
  contactId: "12345",
  pipelineId: "11111",
  createdAt: "12/9/2025, 21:03:38",
  client: { name: "Juan Pérez", id: "549123456789" },
  messageText: "Hola",
  sourceName: "Mi Empresa"
});

// Registrar acción del bot
const botAction = await createBotAction({
  talkId: "talk_123",
  entityId: "lead_456",
  contactId: "contact_789",
  messageText: "Hola, me gustaría obtener más información",
  messageCreatedAt: "12/9/2025, 21:03:38",
  aiDecision: {
    currentStatus: "sin-status",
    newStatus: "Revisar",
    shouldChange: true,
    reasoning: "Mensaje de consulta general que requiere atención humana",
    confidence: 0.85
  },
  statusUpdateResult: {
    success: true
  }
});
```

## Manejo de Errores

Los servicios incluyen manejo de errores adecuado:
- Conexión a MongoDB
- Validación de datos
- Actualización de documentos existentes
- Logging de operaciones
- **Aislamiento de errores**: Los errores en el registro de acciones del bot (`createBotAction`) no afectan el flujo principal de procesamiento de mensajes

Todos los errores son registrados usando el sistema de logging centralizado.
