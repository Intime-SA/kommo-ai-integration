// Service para consumir el API de Logs
// Archivo: service/logs.ts

// Importaciones necesarias
import React from 'react'; // Solo necesario si usas el hook useLogs

// ===== TIPOS E INTERFACES =====

// Tipos de logs disponibles
export type LogType = 'received_messages' | 'change_status' | 'bot_actions';

// Interface base para todos los logs
export interface BaseLogEntry {
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

// Log de mensajes recibidos
export interface ReceivedMessageLog extends BaseLogEntry {
  type: 'received_messages';
  messageText: string;
  messageType: 'incoming' | 'outgoing';
  authorName: string;
  messageId: string;
  chatId: string;
}

// Log de cambios de status
export interface ChangeStatusLog extends BaseLogEntry {
  type: 'change_status';
  oldStatus?: string;
  newStatus: string;
  changedBy: 'bot' | 'manual' | 'system';
  reason?: string;
  confidence?: number;
  success: boolean;
}

// Log de acciones del bot
export interface BotActionLog extends BaseLogEntry {
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
  processingTime: number; // en ms
}

// Tipo union para todos los logs
export type LogEntry = ReceivedMessageLog | ChangeStatusLog | BotActionLog;

// Parámetros de consulta para logs
export interface LogsQueryParams {
  // Filtros de fecha
  startDate?: string;
  endDate?: string;

  // Filtros de tipo y contenido
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

// Respuesta del API de logs
export interface LogsResponse {
  logs: LogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  query: LogsQueryParams;
}

// Headers de respuesta adicionales
export interface LogsResponseHeaders {
  'x-total-count': string;
  'x-has-more': string;
  'x-response-time': string;
}

// Estados de loading y error
export interface LogsLoadingState {
  isLoading: boolean;
  error: string | null;
}

// ===== FUNCIONES DE UTILIDAD =====

// Función para construir URL con parámetros de consulta
function buildUrlWithParams(baseUrl: string, params: LogsQueryParams): string {
  const url = new URL(baseUrl);

  // Función helper para agregar parámetros no vacíos
  const addParam = (key: string, value: any) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value.toString());
    }
  };

  // Agregar todos los parámetros
  addParam('startDate', params.startDate);
  addParam('endDate', params.endDate);
  addParam('logType', params.logType);
  addParam('contactId', params.contactId);
  addParam('leadId', params.leadId);
  addParam('talkId', params.talkId);
  addParam('userName', params.userName);
  addParam('clientId', params.clientId);
  addParam('sourceName', params.sourceName);
  addParam('status', params.status);
  addParam('changedBy', params.changedBy);
  addParam('limit', params.limit);
  addParam('offset', params.offset);
  addParam('sortBy', params.sortBy);
  addParam('sortOrder', params.sortOrder);

  return url.toString();
}

// Función para obtener la fecha de hace N horas
export function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString().replace('T', ' ').slice(0, 19) + '.000Z';
}

// Función para obtener la fecha actual
export function getCurrentDate(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z';
}

// ===== CLASE PRINCIPAL DEL SERVICIO =====

export class LogsService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Configuración automática para desarrollo
    if (!baseUrl) {
      // Detectar si estamos en desarrollo y configurar URL apropiada
      const isDevelopment = typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (isDevelopment) {
        // Si el frontend está en 3000, el backend debe estar en 3001
        const backendPort = window.location.port === '3000' ? '3001' : window.location.port;
        this.baseUrl = `http://localhost:${backendPort}/api/logs`;
      } else {
        this.baseUrl = '/api/logs';
      }
    } else {
      this.baseUrl = baseUrl;
    }
  }

  // Método privado para hacer las llamadas HTTP
  private async makeRequest(
    params: LogsQueryParams = {},
    options: RequestInit = {}
  ): Promise<{ data: LogsResponse | null; headers: LogsResponseHeaders | null; error: string | null }> {
    try {
      const url = buildUrlWithParams(this.baseUrl, params);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      // Extraer headers personalizados
      const headers: LogsResponseHeaders = {
        'x-total-count': response.headers.get('x-total-count') || '',
        'x-has-more': response.headers.get('x-has-more') || '',
        'x-response-time': response.headers.get('x-response-time') || '',
      };

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        return {
          data: null,
          headers: null,
          error: errorData.error || `Error HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data: LogsResponse = await response.json();

      return {
        data,
        headers,
        error: null,
      };
    } catch (error) {
      return {
        data: null,
        headers: null,
        error: error instanceof Error ? error.message : 'Error de red desconocido',
      };
    }
  }

  // ===== MÉTODOS PÚBLICOS =====

  /**
   * Obtener todos los logs con filtros opcionales
   */
  async getLogs(params: LogsQueryParams = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    return this.makeRequest(params);
  }

  /**
   * Obtener logs de las últimas 24 horas
   */
  async getLogsLast24Hours(params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const last24HoursParams: LogsQueryParams = {
      startDate: getDateHoursAgo(24),
      endDate: getCurrentDate(),
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(last24HoursParams);
  }

  /**
   * Obtener logs de las últimas N horas
   */
  async getLogsLastHours(hours: number, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const lastHoursParams: LogsQueryParams = {
      startDate: getDateHoursAgo(hours),
      endDate: getCurrentDate(),
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(lastHoursParams);
  }

  /**
   * Obtener logs de mensajes recibidos
   */
  async getReceivedMessages(params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const messagesParams: LogsQueryParams = {
      logType: 'received_messages',
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(messagesParams);
  }

  /**
   * Obtener logs de cambios de status
   */
  async getStatusChanges(params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const statusParams: LogsQueryParams = {
      logType: 'change_status',
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(statusParams);
  }

  /**
   * Obtener logs de acciones del bot
   */
  async getBotActions(params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const botParams: LogsQueryParams = {
      logType: 'bot_actions',
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(botParams);
  }

  /**
   * Buscar logs por usuario
   */
  async searchByUserName(userName: string, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: LogsQueryParams = {
      userName,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }

  /**
   * Buscar logs por contacto
   */
  async searchByContact(contactId: string, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: LogsQueryParams = {
      contactId,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }

  /**
   * Buscar logs por lead
   */
  async searchByLead(leadId: string, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: LogsQueryParams = {
      leadId,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }

  /**
   * Obtener página específica con paginación
   */
  async getPage(page: number, pageSize: number = 50, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const pageParams: LogsQueryParams = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(pageParams);
  }

  /**
   * Obtener siguiente página
   */
  async getNextPage(currentOffset: number, limit: number = 50, params: Partial<LogsQueryParams> = {}): Promise<{
    data: LogsResponse | null;
    headers: LogsResponseHeaders | null;
    error: string | null;
  }> {
    const nextParams: LogsQueryParams = {
      limit,
      offset: currentOffset + limit,
      sortBy: 'timestamp',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(nextParams);
  }
}

// ===== FUNCIONES DE CONVENIENCIA =====

// Instancia singleton del servicio
export const logsService = new LogsService();

// Funciones de conveniencia para uso directo
export const getLogs = (params?: LogsQueryParams) => logsService.getLogs(params);
export const getLogsLast24Hours = (params?: Partial<LogsQueryParams>) => logsService.getLogsLast24Hours(params);
export const getLogsLastHours = (hours: number, params?: Partial<LogsQueryParams>) => logsService.getLogsLastHours(hours, params);
export const getReceivedMessages = (params?: Partial<LogsQueryParams>) => logsService.getReceivedMessages(params);
export const getStatusChanges = (params?: Partial<LogsQueryParams>) => logsService.getStatusChanges(params);
export const getBotActions = (params?: Partial<LogsQueryParams>) => logsService.getBotActions(params);
export const searchByUserName = (userName: string, params?: Partial<LogsQueryParams>) => logsService.searchByUserName(userName, params);
export const searchByContact = (contactId: string, params?: Partial<LogsQueryParams>) => logsService.searchByContact(contactId, params);
export const searchByLead = (leadId: string, params?: Partial<LogsQueryParams>) => logsService.searchByLead(leadId, params);
export const getPage = (page: number, pageSize?: number, params?: Partial<LogsQueryParams>) => logsService.getPage(page, pageSize, params);
export const getNextPage = (currentOffset: number, limit?: number, params?: Partial<LogsQueryParams>) => logsService.getNextPage(currentOffset, limit, params);

// ===== HOOKS Y UTILIDADES PARA REACT =====

// Hook personalizado para usar logs con React (opcional, si usas React)
export function useLogs() {
  const [state, setState] = React.useState<LogsLoadingState>({
    isLoading: false,
    error: null,
  });

  const [data, setData] = React.useState<LogsResponse | null>(null);
  const [headers, setHeaders] = React.useState<LogsResponseHeaders | null>(null);

  const executeQuery = async (
    queryFn: () => Promise<{
      data: LogsResponse | null;
      headers: LogsResponseHeaders | null;
      error: string | null;
    }>
  ) => {
    setState({ isLoading: true, error: null });

    try {
      const result = await queryFn();
      setData(result.data);
      setHeaders(result.headers);
      setState({ isLoading: false, error: result.error });
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      setState({ isLoading: false, error: errorMessage });
      return { data: null, headers: null, error: errorMessage };
    }
  };

  return {
    // Estado
    isLoading: state.isLoading,
    error: state.error,
    data,
    headers,

    // Acciones
    executeQuery,
    clearError: () => setState(prev => ({ ...prev, error: null })),
    reset: () => {
      setData(null);
      setHeaders(null);
      setState({ isLoading: false, error: null });
    },
  };
}

// Función helper para formatear fechas en el frontend
export function formatLogDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Función helper para obtener el color/tipo de badge según el tipo de log
export function getLogTypeInfo(logType: LogType): {
  label: string;
  color: 'blue' | 'green' | 'orange' | 'red' | 'gray';
  icon: string;
} {
  switch (logType) {
    case 'received_messages':
      return { label: 'Mensaje', color: 'blue', icon: '💬' };
    case 'change_status':
      return { label: 'Cambio Status', color: 'green', icon: '🔄' };
    case 'bot_actions':
      return { label: 'Acción Bot', color: 'orange', icon: '🤖' };
    default:
      return { label: 'Desconocido', color: 'gray', icon: '❓' };
  }
}

// Función helper para obtener el color según el status
export function getStatusColor(status: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  switch (status.toLowerCase()) {
    case 'cargo':
      return 'success';
    case 'nocargo':
      return 'warning';
    case 'noatender':
      return 'error';
    case 'pidiousuario':
      return 'info';
    case 'pidiousuario':
      return 'info';
    default:
      return 'default';
  }
}
