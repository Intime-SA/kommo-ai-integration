import { NextRequest, NextResponse } from 'next/server';
import {
  getRuleById,
  updateRule,
  deleteRule,
} from '@/lib/mongodb-services';
import { logOutgoingHttpRequest, logIncomingHttpResponse, logHttpError } from '@/lib/logger';
import { RuleDocument } from '@/types/kommo';

// Validar datos para actualizar regla
function validateUpdateData(data: any): Partial<Omit<RuleDocument, '_id' | 'createdAt'>> {
  const allowedFields = ['rule', 'text', 'crm', 'pipeline', 'priority', 'status'];
  const updateData: any = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  // Validaciones específicas
  if (updateData.rule !== undefined) {
    if (typeof updateData.rule !== 'string' || updateData.rule.trim().length === 0) {
      throw new Error('rule debe ser un string no vacío');
    }
    updateData.rule = updateData.rule.trim();
  }

  if (updateData.text !== undefined) {
    if (typeof updateData.text !== 'string' || updateData.text.trim().length === 0) {
      throw new Error('text debe ser un string no vacío');
    }
    updateData.text = updateData.text.trim();
  }

  if (updateData.crm !== undefined) {
    if (typeof updateData.crm !== 'string' || updateData.crm.trim().length === 0) {
      throw new Error('crm debe ser un string no vacío');
    }
    updateData.crm = updateData.crm.trim();
  }

  if (updateData.pipeline !== undefined) {
    if (typeof updateData.pipeline !== 'string' || updateData.pipeline.trim().length === 0) {
      throw new Error('pipeline debe ser un string no vacío');
    }
    updateData.pipeline = updateData.pipeline.trim();
  }

  if (updateData.priority !== undefined) {
    if (typeof updateData.priority !== 'number' || updateData.priority < 0 || updateData.priority > 10) {
      throw new Error('priority debe ser un número entre 0 y 10');
    }
  }

  if (updateData.status !== undefined) {
    if (typeof updateData.status !== 'string' || !['active', 'inactive', 'draft'].includes(updateData.status)) {
      throw new Error('status debe ser uno de: active, inactive, draft');
    }
  }

  return updateData;
}

// GET /api/rules/[id] - Obtener una regla específica por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<RuleDocument | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    logOutgoingHttpRequest('GET', `/api/rules/${params.id}`, {}, {});

    // Obtener la regla por ID
    const rule: RuleDocument | null = await getRuleById(params.id);

    const responseTime = Date.now() - startTime;

    if (!rule) {
      // Log de regla no encontrada
      logIncomingHttpResponse(404, 'Not Found', `Regla con ID ${params.id} no encontrada`, responseTime);

      return NextResponse.json(
        { error: 'Regla no encontrada' },
        {
          status: 404,
          headers: {
            'X-Response-Time': `${responseTime}ms`
          }
        }
      );
    }

    // Log de respuesta exitosa
    logIncomingHttpResponse(200, 'OK', `Regla obtenida: ${rule.rule}`, responseTime);

    // Devolver respuesta exitosa
    return NextResponse.json(rule, {
      status: 200,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Log del error
    logHttpError(`GET /api/rules/${params.id}`, error, `/api/rules/${params.id}`);

    // Devolver respuesta de error
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

// PUT /api/rules/[id] - Actualizar una regla específica por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<RuleDocument | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    logOutgoingHttpRequest('PUT', `/api/rules/${params.id}`, {}, {});

    // Obtener y validar datos del body
    const body = await request.json();
    const updateData = validateUpdateData(body);

    // Actualizar la regla
    const updatedRule: RuleDocument | null = await updateRule(params.id, updateData);

    const responseTime = Date.now() - startTime;

    if (!updatedRule) {
      // Log de regla no encontrada
      logIncomingHttpResponse(404, 'Not Found', `Regla con ID ${params.id} no encontrada`, responseTime);

      return NextResponse.json(
        { error: 'Regla no encontrada' },
        {
          status: 404,
          headers: {
            'X-Response-Time': `${responseTime}ms`
          }
        }
      );
    }

    // Log de respuesta exitosa
    logIncomingHttpResponse(200, 'OK', `Regla actualizada: ${updatedRule.rule}`, responseTime);

    // Devolver respuesta exitosa
    return NextResponse.json(updatedRule, {
      status: 200,
      headers: {
        'X-Response-Time': `${responseTime}ms`
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Log del error
    logHttpError(`PUT /api/rules/${params.id}`, error, `/api/rules/${params.id}`);

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

// DELETE /api/rules/[id] - Eliminar una regla específica por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<{ success: boolean; message: string } | { error: string }>> {
  const startTime = Date.now();

  try {
    // Log de la petición
    logOutgoingHttpRequest('DELETE', `/api/rules/${params.id}`, {}, {});

    // Eliminar la regla
    const deleted: boolean = await deleteRule(params.id);

    const responseTime = Date.now() - startTime;

    if (!deleted) {
      // Log de regla no encontrada
      logIncomingHttpResponse(404, 'Not Found', `Regla con ID ${params.id} no encontrada`, responseTime);

      return NextResponse.json(
        { error: 'Regla no encontrada' },
        {
          status: 404,
          headers: {
            'X-Response-Time': `${responseTime}ms`
          }
        }
      );
    }

    // Log de respuesta exitosa
    logIncomingHttpResponse(200, 'OK', `Regla eliminada con ID: ${params.id}`, responseTime);

    // Devolver respuesta exitosa
    return NextResponse.json(
      {
        success: true,
        message: 'Regla eliminada exitosamente'
      },
      {
        status: 200,
        headers: {
          'X-Response-Time': `${responseTime}ms`
        }
      }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

    // Log del error
    logHttpError(`DELETE /api/rules/${params.id}`, error, `/api/rules/${params.id}`);

    // Devolver respuesta de error
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
