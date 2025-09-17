// Service para consumir el API de Rules
// Archivo: service/rules.ts

// Importaciones necesarias
import React from 'react'; // Solo necesario si usas el hook useRules

// ===== TIPOS E INTERFACES =====

// Interface para una regla
export interface RuleDocument {
  _id?: string;
  createdAt: string; // ISO string en horario Argentina
  updatedAt: string; // ISO string en horario Argentina
  rule: string; // Número o identificador de la regla
  text: string; // Texto descriptivo de la regla
  crm: string; // Sistema CRM utilizado
  pipeline: string; // Pipeline donde se aplica
  priority: number; // Prioridad de la regla
  status: 'active' | 'inactive' | 'draft'; // Estado de la regla
}

// Interface para crear una nueva regla (sin _id y campos automáticos)
export interface CreateRuleData {
  rule: string;
  text: string;
  crm: string;
  pipeline: string;
  priority: number;
  status: 'active' | 'inactive' | 'draft';
}

// Interface para actualizar una regla
export interface UpdateRuleData {
  rule?: string;
  text?: string;
  crm?: string;
  pipeline?: string;
  priority?: number;
  status?: 'active' | 'inactive' | 'draft';
}

// Parámetros de consulta para rules
export interface RulesQueryParams {
  // Filtros de fecha
  startDate?: string;
  endDate?: string;

  // Filtros de contenido
  rule?: string;
  text?: string;
  crm?: string;
  pipeline?: string;
  status?: 'active' | 'inactive' | 'draft';
  priority?: number;

  // Paginación
  limit?: number;
  offset?: number;

  // Ordenamiento
  sortBy?: 'createdAt' | 'updatedAt' | 'rule' | 'priority' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// Respuesta del API de rules
export interface RulesResponse {
  rules: RuleDocument[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  query: RulesQueryParams;
}

// Headers de respuesta adicionales
export interface RulesResponseHeaders {
  'x-total-count': string;
  'x-has-more': string;
  'x-response-time': string;
}

// Estados de loading y error
export interface RulesLoadingState {
  isLoading: boolean;
  error: string | null;
}

// ===== FUNCIONES DE UTILIDAD =====

// Función para construir URL con parámetros de consulta
function buildUrlWithParams(baseUrl: string, params: RulesQueryParams): string {
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
  addParam('rule', params.rule);
  addParam('text', params.text);
  addParam('crm', params.crm);
  addParam('pipeline', params.pipeline);
  addParam('status', params.status);
  addParam('priority', params.priority);
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

export class RulesService {
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
        this.baseUrl = `http://localhost:${backendPort}/api/rules`;
      } else {
        this.baseUrl = '/api/rules';
      }
    } else {
      this.baseUrl = baseUrl;
    }
  }

  // Método privado para hacer las llamadas HTTP
  private async makeRequest<T = RulesResponse>(
    params: RulesQueryParams = {},
    options: RequestInit = {}
  ): Promise<{ data: T | null; headers: RulesResponseHeaders | null; error: string | null }> {
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
      const headers: RulesResponseHeaders = {
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

      const data: T = await response.json();

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
   * Obtener todas las reglas con filtros opcionales
   */
  async getRules(params: RulesQueryParams = {}): Promise<{
    data: RulesResponse | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    return this.makeRequest(params);
  }

  /**
   * Obtener una regla por ID
   */
  async getRuleById(id: string): Promise<{
    data: RuleDocument | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    return this.makeRequest({ rule: id });
  }

  /**
   * Crear una nueva regla
   */
  async createRule(ruleData: CreateRuleData): Promise<{
    data: RuleDocument | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ruleData),
      });

      const headers: RulesResponseHeaders = {
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

      const data: RuleDocument = await response.json();

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

  /**
   * Actualizar una regla existente
   */
  async updateRule(id: string, updateData: UpdateRuleData): Promise<{
    data: RuleDocument | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const headers: RulesResponseHeaders = {
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

      const data: RuleDocument = await response.json();

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

  /**
   * Eliminar una regla
   */
  async deleteRule(id: string): Promise<{
    data: { success: boolean; message: string } | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
      });

      const headers: RulesResponseHeaders = {
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

      const data: { success: boolean; message: string } = await response.json();

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

  /**
   * Obtener reglas por CRM
   */
  async getRulesByCrm(crm: string, params: Partial<RulesQueryParams> = {}): Promise<{
    data: RulesResponse | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: RulesQueryParams = {
      crm,
      limit: 50,
      sortBy: 'priority',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }

  /**
   * Obtener reglas por pipeline
   */
  async getRulesByPipeline(pipeline: string, params: Partial<RulesQueryParams> = {}): Promise<{
    data: RulesResponse | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: RulesQueryParams = {
      pipeline,
      limit: 50,
      sortBy: 'priority',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }

  /**
   * Obtener reglas activas
   */
  async getActiveRules(params: Partial<RulesQueryParams> = {}): Promise<{
    data: RulesResponse | null;
    headers: RulesResponseHeaders | null;
    error: string | null;
  }> {
    const searchParams: RulesQueryParams = {
      status: 'active',
      limit: 50,
      sortBy: 'priority',
      sortOrder: 'desc',
      ...params,
    };

    return this.makeRequest(searchParams);
  }
}

// ===== FUNCIONES DE CONVENIENCIA =====

// Instancia singleton del servicio
export const rulesService = new RulesService();

// Funciones de conveniencia para uso directo
export const getRules = (params?: RulesQueryParams) => rulesService.getRules(params);
export const getRuleById = (id: string) => rulesService.getRuleById(id);
export const createRule = (ruleData: CreateRuleData) => rulesService.createRule(ruleData);
export const updateRule = (id: string, updateData: UpdateRuleData) => rulesService.updateRule(id, updateData);
export const deleteRule = (id: string) => rulesService.deleteRule(id);
export const getRulesByCrm = (crm: string, params?: Partial<RulesQueryParams>) => rulesService.getRulesByCrm(crm, params);
export const getRulesByPipeline = (pipeline: string, params?: Partial<RulesQueryParams>) => rulesService.getRulesByPipeline(pipeline, params);
export const getActiveRules = (params?: Partial<RulesQueryParams>) => rulesService.getActiveRules(params);

// ===== HOOKS Y UTILIDADES PARA REACT =====

// Hook personalizado para usar rules con React (opcional, si usas React)
export function useRules() {
  const [state, setState] = React.useState<RulesLoadingState>({
    isLoading: false,
    error: null,
  });

  const [data, setData] = React.useState<RulesResponse | null>(null);
  const [headers, setHeaders] = React.useState<RulesResponseHeaders | null>(null);

  const executeQuery = async (
    queryFn: () => Promise<{
      data: RulesResponse | null;
      headers: RulesResponseHeaders | null;
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
export function formatRuleDate(dateString: string): string {
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

// Función helper para obtener el color/tipo de badge según el status
export function getRuleStatusInfo(status: 'active' | 'inactive' | 'draft'): {
  label: string;
  color: 'success' | 'warning' | 'info' | 'default';
  icon: string;
} {
  switch (status) {
    case 'active':
      return { label: 'Activa', color: 'success', icon: '✅' };
    case 'inactive':
      return { label: 'Inactiva', color: 'warning', icon: '⏸️' };
    case 'draft':
      return { label: 'Borrador', color: 'info', icon: '📝' };
    default:
      return { label: 'Desconocido', color: 'default', icon: '❓' };
  }
}

// Función helper para obtener el color según la prioridad
export function getPriorityColor(priority: number): 'error' | 'warning' | 'info' | 'success' {
  if (priority >= 8) return 'error';
  if (priority >= 6) return 'warning';
  if (priority >= 4) return 'info';
  return 'success';
}
