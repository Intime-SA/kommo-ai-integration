import { NextRequest, NextResponse } from 'next/server';
import {
  getConsolidatedLogs,
  LogsQueryParams,
  LogsResponse,
  LogType
} from '@/lib/mongodb-services';
import { logOutgoingHttpRequest, logIncomingHttpResponse, logHttpError } from '@/lib/logger';

// Validación de parámetros de consulta
function validateAndParseParams(request: NextRequest): LogsQueryParams {
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

  const params: LogsQueryParams = {
    searchTerm: parseString(searchParams.get('searchTerm')),
    startDate: parseDateString(searchParams.get('startDate')),
    endDate: parseDateString(searchParams.get('endDate')),
    logType: parseString(searchParams.get('logType')) as LogType,
    contactId: parseString(searchParams.get('contactId')),
    leadId: parseString(searchParams.get('leadId')),
    talkId: parseString(searchParams.get('talkId')),
    userName: parseString(searchParams.get('userName')),
    clientId: parseString(searchParams.get('clientId')),
    sourceName: parseString(searchParams.get('sourceName')),
    status: parseString(searchParams.get('status')),
    changedBy: parseString(searchParams.get('changedBy')) as 'bot' | 'manual' | 'system',
    limit: parseNumber(searchParams.get('limit'), 50),
    offset: parseNumber(searchParams.get('offset'), 0, true), // true = permitir 0 para offset
    sortBy: parseString(searchParams.get('sortBy')) as 'timestamp' | 'userName' | 'contactId' | 'type' | 'leadId',
    sortOrder: parseString(searchParams.get('sortOrder')) as 'asc' | 'desc'
  };

  // Validar fechas si están presentes
  if (params.startDate && !isValidDate(params.startDate)) {
    throw new Error('startDate debe ser una fecha válida');
  }
  if (params.endDate && !isValidDate(params.endDate)) {
    throw new Error('endDate debe ser una fecha válida');
  }

  // Validar logType si está presente
  if (params.logType && !['received_messages', 'change_status', 'bot_actions'].includes(params.logType)) {
    throw new Error('logType debe ser uno de: received_messages, change_status, bot_actions');
  }

  // Validar changedBy si está presente
  if (params.changedBy && !['bot', 'manual', 'system'].includes(params.changedBy)) {
    throw new Error('changedBy debe ser uno de: bot, manual, system');
  }

  // Validar sortBy si está presente
  if (params.sortBy && !['timestamp', 'userName', 'contactId', 'type', 'leadId'].includes(params.sortBy)) {
    throw new Error('sortBy debe ser uno de: timestamp, userName, contactId, type, leadId');
  }

  // Validar sortOrder si está presente
  if (params.sortOrder && !['asc', 'desc'].includes(params.sortOrder)) {
    throw new Error('sortOrder debe ser uno de: asc, desc');
  }

  return params;
}

// GET /api/logs - Obtener logs consolidados
export async function GET(request: NextRequest): Promise<NextResponse<LogsResponse | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    /* logOutgoingHttpRequest('GET', '/api/logs', {}, Object.fromEntries(new URL(request.url).searchParams)); */

    // Validar y parsear parámetros
    const params = validateAndParseParams(request);

    // Obtener logs consolidados
    const result: LogsResponse = await getConsolidatedLogs(params);

    const responseTime = Date.now() - startTime;

    // Log de respuesta exitosa
    logIncomingHttpResponse(200, 'OK', `Obtenidos ${result.logs.length} logs de ${result.total} total`, responseTime);

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
    logHttpError('GET /api/logs', error, '/api/logs');

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

// POST /api/logs - Endpoint para crear logs (si es necesario en el futuro)
export async function POST(request: NextRequest): Promise<NextResponse<{ message: string } | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    /* logOutgoingHttpRequest('POST', '/api/logs', {}, {}); */

    // Este endpoint podría usarse para crear logs manuales si es necesario
    // Por ahora, devolver que no está implementado
    const responseTime = Date.now() - startTime;

    logIncomingHttpResponse(501, 'Not Implemented', 'Endpoint POST no implementado', responseTime);

    return NextResponse.json(
      { message: 'Endpoint POST no implementado. Use GET para consultar logs.' },
      {
        status: 501,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    logHttpError('POST /api/logs', error, '/api/logs');

    return NextResponse.json(
      { error: errorMessage },
      {
        status: 500,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );
  }
}
