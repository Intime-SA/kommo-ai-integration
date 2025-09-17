import { NextRequest, NextResponse } from 'next/server';
import {
  createRule,
  getRules,
  getRuleById,
  getRuleByRuleNumber,
  updateRule,
  updateRuleByRuleNumber,
  deleteRule,
  deleteRuleByRuleNumber,
  RulesQueryParams,
  RulesResponse,
  RuleDocument
} from '@/lib/mongodb-services';
import { logOutgoingHttpRequest, logIncomingHttpResponse, logHttpError } from '@/lib/logger';

// Validación de parámetros de consulta
function validateAndParseParams(request: NextRequest): RulesQueryParams {
  const { searchParams } = new URL(request.url);

  // Función helper para validar fechas
  const isValidDate = (dateString: string): boolean => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  // Función helper para validar números
  const parseNumber = (value: string | null, defaultValue: number, allowZero: boolean = false): number => {
    if (!value) return defaultValue;
    const num = parseInt(value, 10);
    if (isNaN(num)) return defaultValue;
    const minValue = allowZero ? 0 : 1;
    return Math.max(minValue, Math.min(1000, num));
  };

  // Función helper para validar strings
  const parseString = (value: string | null): string | undefined => {
    return value?.trim() || undefined;
  };

  // Función helper para parsear y completar fechas
  const parseDateString = (value: string | null): string | undefined => {
    if (!value?.trim()) return undefined;

    let dateStr = value.trim();

    // Si no tiene zona horaria, agregar Z (UTC)
    if (!dateStr.includes('Z') && !dateStr.includes('+') && !dateStr.includes('-')) {
      // Completar con segundos y zona horaria si faltan
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        dateStr += ':00.000Z';
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        dateStr += '.000Z';
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/)) {
        dateStr += 'Z';
      } else if (!dateStr.includes('Z') && !dateStr.includes('+')) {
        dateStr += 'Z';
      }
    }

    return dateStr;
  };

  const params: RulesQueryParams = {
    startDate: parseDateString(searchParams.get('startDate')),
    endDate: parseDateString(searchParams.get('endDate')),
    rule: parseString(searchParams.get('rule')),
    text: parseString(searchParams.get('text')),
    crm: parseString(searchParams.get('crm')),
    pipeline: parseString(searchParams.get('pipeline')),
    status: parseString(searchParams.get('status')) as 'active' | 'inactive' | 'draft',
    priority: searchParams.get('priority') ? parseInt(searchParams.get('priority')!, 10) : undefined,
    limit: parseNumber(searchParams.get('limit'), 50),
    offset: parseNumber(searchParams.get('offset'), 0, true), // true = permitir 0 para offset
    sortBy: parseString(searchParams.get('sortBy')) as 'createdAt' | 'updatedAt' | 'rule' | 'priority' | 'status',
    sortOrder: parseString(searchParams.get('sortOrder')) as 'asc' | 'desc'
  };

  // Validar fechas si están presentes
  if (params.startDate && !isValidDate(params.startDate)) {
    throw new Error('startDate debe ser una fecha válida');
  }
  if (params.endDate && !isValidDate(params.endDate)) {
    throw new Error('endDate debe ser una fecha válida');
  }

  // Validar status si está presente
  if (params.status && !['active', 'inactive', 'draft'].includes(params.status)) {
    throw new Error('status debe ser uno de: active, inactive, draft');
  }

  // Validar sortBy si está presente
  if (params.sortBy && !['createdAt', 'updatedAt', 'rule', 'priority', 'status'].includes(params.sortBy)) {
    throw new Error('sortBy debe ser uno de: createdAt, updatedAt, rule, priority, status');
  }

  // Validar sortOrder si está presente
  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    throw new Error('sortOrder debe ser uno de: asc, desc');
  }

  return params;
}

// Validar datos para crear regla
function validateRuleData(data: any): Omit<RuleDocument, '_id' | 'createdAt' | 'updatedAt'> {
  const { rule, text, crm, pipeline, priority, status } = data;

  if (!rule || typeof rule !== 'string' || rule.trim().length === 0) {
    throw new Error('rule es requerido y debe ser un string no vacío');
  }

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text es requerido y debe ser un string no vacío');
  }

  if (!crm || typeof crm !== 'string' || crm.trim().length === 0) {
    throw new Error('crm es requerido y debe ser un string no vacío');
  }

  if (!pipeline || typeof pipeline !== 'string' || pipeline.trim().length === 0) {
    throw new Error('pipeline es requerido y debe ser un string no vacío');
  }

  if (priority === undefined || typeof priority !== 'number' || priority < 0 || priority > 10) {
    throw new Error('priority es requerido y debe ser un número entre 0 y 10');
  }

  if (!status || typeof status !== 'string' || !['active', 'inactive', 'draft'].includes(status)) {
    throw new Error('status es requerido y debe ser uno de: active, inactive, draft');
  }

  return {
    rule: rule.trim(),
    text: text.trim(),
    crm: crm.trim(),
    pipeline: pipeline.trim(),
    priority,
    status: status as 'active' | 'inactive' | 'draft'
  };
}

// GET /api/rules - Obtener todas las reglas
export async function GET(request: NextRequest): Promise<NextResponse<RulesResponse | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    logOutgoingHttpRequest('GET', '/api/rules', {}, Object.fromEntries(new URL(request.url).searchParams));

    // Validar y parsear parámetros
    const params = validateAndParseParams(request);

    // Obtener reglas
    const result: RulesResponse = await getRules(params);

    const responseTime = Date.now() - startTime;

    // Log de respuesta exitosa
    logIncomingHttpResponse(200, 'OK', `Obtenidas ${result.rules.length} reglas de ${result.total} total`, responseTime);

    // Devolver respuesta exitosa
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache',
        'X-Total-Count': result.total.toString(),
        'X-Has-More': result.hasMore.toString(),
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Log del error
    logHttpError('GET /api/rules', error, '/api/rules');

    // Devolver respuesta de error
    return NextResponse.json(
      { error: errorMessage },
      {
        status: error instanceof Error && errorMessage.includes('debe ser') ? 400 : 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
  }
}

// POST /api/rules - Crear una nueva regla
export async function POST(request: NextRequest): Promise<NextResponse<RuleDocument | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    logOutgoingHttpRequest('POST', '/api/rules', {}, {});

    // Obtener y validar datos del body
    const body = await request.json();
    const ruleData = validateRuleData(body);

    // Crear la regla
    const newRule: RuleDocument = await createRule(ruleData);

    const responseTime = Date.now() - startTime;

    // Log de respuesta exitosa
    logIncomingHttpResponse(201, 'Created', `Regla creada con ID: ${newRule._id}`, responseTime);

    // Devolver respuesta exitosa
    return NextResponse.json(newRule, {
      status: 201,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Log del error
    logHttpError('POST /api/rules', error, '/api/rules');

    // Devolver respuesta de error
    return NextResponse.json(
      { error: errorMessage },
      {
        status: error instanceof Error && errorMessage.includes('requerido') ? 400 : 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
  }
}
