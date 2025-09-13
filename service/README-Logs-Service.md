# Servicio de Logs - Frontend

## Descripción

Este servicio proporciona una interfaz completa para consumir el API de logs desde el frontend de tu aplicación React/Next.js. Incluye tipos TypeScript, hooks personalizados, y componentes de ejemplo listos para usar.

## Archivos del Servicio

### `service/logs.ts`
Archivo principal del servicio con:
- Interfaces TypeScript completas
- Clase `LogsService` con todos los métodos
- Funciones de conveniencia
- Hook personalizado `useLogs`
- Utilidades helper

### `service/logs-examples.tsx`
Componentes de ejemplo que muestran cómo usar el servicio:
- `LogsList`: Listado básico de logs
- `LogsWithFilters`: Filtros avanzados
- `LogsDashboard`: Dashboard con estadísticas
- `LogsSearch`: Búsqueda en tiempo real

## Instalación y Configuración

### 1. Importar el servicio

```typescript
import {
  logsService,
  getLogsLast24Hours,
  getReceivedMessages,
  getStatusChanges,
  getBotActions,
  useLogs
} from '@/service/logs';
```

### 2. Uso básico con hooks

```typescript
import { useLogs } from '@/service/logs';

function MyComponent() {
  const { isLoading, error, data, executeQuery } = useLogs();

  // Cargar logs de las últimas 24 horas
  const loadLogs = () => {
    executeQuery(() => getLogsLast24Hours({ limit: 20 }));
  };

  if (isLoading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <button onClick={loadLogs}>Cargar Logs</button>
      {data?.logs.map(log => (
        <div key={log.id}>
          {log.userName}: {log.timestamp}
        </div>
      ))}
    </div>
  );
}
```

### 3. Uso con funciones directas

```typescript
import { getLogsLast24Hours, searchByUserName } from '@/service/logs';

// Cargar logs de las últimas 24 horas
const loadRecentLogs = async () => {
  const result = await getLogsLast24Hours({
    limit: 50,
    sortBy: 'timestamp',
    sortOrder: 'desc'
  });

  if (result.error) {
    console.error('Error:', result.error);
    return;
  }

  console.log('Logs obtenidos:', result.data?.logs);
  console.log('Total:', result.data?.total);
  console.log('Headers:', result.headers);
};

// Buscar por usuario
const searchUser = async (userName: string) => {
  const result = await searchByUserName(userName, {
    startDate: '2025-09-13T00:00:00.000Z',
    endDate: '2025-09-13T23:59:59.000Z'
  });

  return result;
};
```

## API del Servicio

### Clase LogsService

```typescript
const logsService = new LogsService('/api/logs'); // URL base opcional
```

#### Métodos principales:

- `getLogs(params)`: Consulta general con filtros
- `getLogsLast24Hours(params)`: Últimas 24 horas
- `getLogsLastHours(hours, params)`: Últimas N horas
- `getReceivedMessages(params)`: Solo mensajes recibidos
- `getStatusChanges(params)`: Solo cambios de status
- `getBotActions(params)`: Solo acciones del bot
- `searchByUserName(userName, params)`: Buscar por usuario
- `searchByContact(contactId, params)`: Buscar por contacto
- `searchByLead(leadId, params)`: Buscar por lead
- `getPage(page, pageSize, params)`: Paginación por página
- `getNextPage(offset, limit, params)`: Página siguiente

### Funciones de Conveniencia

```typescript
// Todas las funciones devuelven la misma estructura:
// { data: LogsResponse | null, headers: Headers | null, error: string | null }

const result = await getLogsLast24Hours({
  limit: 20,
  sortBy: 'timestamp',
  sortOrder: 'desc'
});

if (result.error) {
  // Manejar error
  console.error(result.error);
} else {
  // Usar datos
  console.log(result.data?.logs);
  console.log(result.headers?.['x-total-count']);
}
```

## Tipos TypeScript

### Interfaces principales:

```typescript
interface BaseLogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  contactId: string;
  leadId?: string;
  talkId?: string;
  userName: string;
  clientId: string;
  sourceName: string;
}

interface ReceivedMessageLog extends BaseLogEntry {
  type: 'received_messages';
  messageText: string;
  messageType: 'incoming' | 'outgoing';
  authorName: string;
  messageId: string;
  chatId: string;
}

interface ChangeStatusLog extends BaseLogEntry {
  type: 'change_status';
  oldStatus?: string;
  newStatus: string;
  changedBy: 'bot' | 'manual' | 'system';
  reason?: string;
  confidence?: number;
  success: boolean;
}

interface BotActionLog extends BaseLogEntry {
  type: 'bot_actions';
  messageText: string;
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
  processingTime: number;
}
```

### Parámetros de consulta:

```typescript
interface LogsQueryParams {
  // Fechas
  startDate?: string;
  endDate?: string;

  // Filtros
  logType?: LogType;
  contactId?: string;
  leadId?: string;
  talkId?: string;
  userName?: string;
  clientId?: string;
  sourceName?: string;
  status?: string;
  changedBy?: 'bot' | 'manual' | 'system';

  // Paginación
  limit?: number;
  offset?: number;

  // Ordenamiento
  sortBy?: 'timestamp' | 'userName' | 'contactId' | 'type';
  sortOrder?: 'asc' | 'desc';
}
```

## Hook Personalizado useLogs

```typescript
const {
  isLoading,    // boolean
  error,        // string | null
  data,         // LogsResponse | null
  headers,      // Headers | null
  executeQuery, // (queryFn) => Promise
  clearError,   // () => void
  reset         // () => void
} = useLogs();
```

### Ejemplo de uso del hook:

```typescript
function LogsComponent() {
  const { isLoading, error, data, executeQuery } = useLogs();

  useEffect(() => {
    executeQuery(() => getLogsLast24Hours({ limit: 20 }));
  }, []);

  const loadMore = () => {
    if (data?.hasMore) {
      executeQuery(() =>
        getNextPage(data.offset, data.limit, {
          startDate: data.query.startDate,
          endDate: data.query.endDate
        })
      );
    }
  };

  return (
    <div>
      {isLoading && <p>Cargando...</p>}
      {error && <p>Error: {error}</p>}

      {data?.logs.map(log => (
        <div key={log.id}>
          <strong>{log.userName}</strong>: {log.timestamp}
        </div>
      ))}

      {data?.hasMore && (
        <button onClick={loadMore}>Cargar más</button>
      )}
    </div>
  );
}
```

## Utilidades Helper

### Fechas:
```typescript
import { getDateHoursAgo, getCurrentDate } from '@/service/logs';

// Fecha de hace 24 horas
const yesterday = getDateHoursAgo(24);

// Fecha actual
const now = getCurrentDate();
```

### Formateo de fechas:
```typescript
import { formatLogDate } from '@/service/logs';

// Formatear fecha para display
const formattedDate = formatLogDate('2025-09-13T11:21:53.000Z');
// Resultado: "13/09/2025 11:21:53"
```

### Información de tipos:
```typescript
import { getLogTypeInfo, getStatusColor } from '@/service/logs';

// Obtener info del tipo de log
const typeInfo = getLogTypeInfo('received_messages');
// { label: 'Mensaje', color: 'blue', icon: '💬' }

// Obtener color del status
const statusColor = getStatusColor('Cargo');
// 'success'
```

## Ejemplos de Implementación

### 1. Dashboard simple:

```typescript
function SimpleDashboard() {
  const { isLoading, data, executeQuery } = useLogs();

  useEffect(() => {
    executeQuery(() => getLogsLast24Hours({ limit: 10 }));
  }, []);

  if (isLoading) return <div>Cargando dashboard...</div>;

  return (
    <div>
      <h2>Dashboard de Logs</h2>
      <p>Total de logs en 24h: {data?.total || 0}</p>

      <div className="logs-list">
        {data?.logs.map(log => (
          <div key={log.id} className="log-item">
            <span>{formatLogDate(log.timestamp)}</span>
            <span>{log.userName}</span>
            <span>{log.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 2. Búsqueda con filtros:

```typescript
function SearchWithFilters() {
  const [userName, setUserName] = useState('');
  const [contactId, setContactId] = useState('');
  const { isLoading, data, executeQuery } = useLogs();

  const handleSearch = () => {
    executeQuery(() =>
      logsService.getLogs({
        userName: userName || undefined,
        contactId: contactId || undefined,
        startDate: getDateHoursAgo(24),
        endDate: getCurrentDate(),
        limit: 20
      })
    );
  };

  return (
    <div>
      <input
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        placeholder="Nombre de usuario"
      />
      <input
        value={contactId}
        onChange={(e) => setContactId(e.target.value)}
        placeholder="ID de contacto"
      />
      <button onClick={handleSearch}>Buscar</button>

      {data?.logs.map(log => (
        <div key={log.id}>
          {log.userName} - {log.contactId} - {formatLogDate(log.timestamp)}
        </div>
      ))}
    </div>
  );
}
```

### 3. Paginación manual:

```typescript
function PaginatedLogs() {
  const [currentPage, setCurrentPage] = useState(1);
  const { isLoading, data, executeQuery } = useLogs();
  const pageSize = 20;

  const loadPage = (page: number) => {
    setCurrentPage(page);
    executeQuery(() => getPage(page, pageSize, {
      startDate: getDateHoursAgo(24),
      endDate: getCurrentDate()
    }));
  };

  useEffect(() => {
    loadPage(1);
  }, []);

  return (
    <div>
      <div className="pagination-controls">
        <button
          disabled={currentPage === 1}
          onClick={() => loadPage(currentPage - 1)}
        >
          Anterior
        </button>

        <span>Página {currentPage}</span>

        <button
          disabled={!data?.hasMore}
          onClick={() => loadPage(currentPage + 1)}
        >
          Siguiente
        </button>
      </div>

      {data?.logs.map(log => (
        <div key={log.id}>
          {formatLogDate(log.timestamp)} - {log.userName}
        </div>
      ))}
    </div>
  );
}
```

## Manejo de Errores

```typescript
// El servicio maneja errores automáticamente
const result = await getLogsLast24Hours();

if (result.error) {
  // Mostrar error al usuario
  alert(`Error: ${result.error}`);
} else {
  // Procesar datos
  console.log(result.data);
}

// Con el hook useLogs
const { error, clearError } = useLogs();

if (error) {
  return (
    <div>
      <p>Error: {error}</p>
      <button onClick={clearError}>Reintentar</button>
    </div>
  );
}
```

## Optimizaciones de Rendimiento

1. **Debounced Search**: Para búsquedas en tiempo real
2. **Lazy Loading**: Cargar datos solo cuando sean necesarios
3. **Cache**: Implementar cache para consultas frecuentes
4. **Pagination**: Usar paginación para datasets grandes

## Configuración Avanzada

### Cambiar URL base:
```typescript
const customService = new LogsService('https://mi-api.com/api/logs');
```

### Configurar timeouts:
```typescript
const result = await logsService.makeRequest(params, {
  signal: AbortSignal.timeout(5000) // 5 segundos timeout
});
```

## Próximos Pasos

1. Agregar más filtros según necesidades
2. Implementar cache local
3. Agregar retry automático en caso de errores
4. Crear más hooks especializados
5. Agregar métricas de rendimiento
