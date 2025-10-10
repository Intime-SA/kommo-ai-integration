import { NextRequest, NextResponse } from 'next/server';
import { getAllStatus, createStatus } from '../../../lib/mongodb-services';

// GET - Obtener todos los documentos de status
export async function GET(request: NextRequest) {
  try {
    const status = await getAllStatus();

    return NextResponse.json({
      success: true,
      data: status,
      count: status.length
    });

  } catch (error) {
    console.error('Error al obtener status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo documento de status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar campos requeridos
    if (!body.statusId || !body.name || !body.description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos requeridos faltantes',
          message: 'Debe proporcionar statusId, name y description'
        },
        { status: 400 }
      );
    }

    // Validar tipos de datos
    if (typeof body.statusId !== 'string' || typeof body.name !== 'string' || typeof body.description !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipos de datos inválidos',
          message: 'statusId, name y description deben ser strings'
        },
        { status: 400 }
      );
    }

    // Validar color si está presente (opcional)
    if (body.color !== undefined && typeof body.color !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de dato inválido',
          message: 'color debe ser un string'
        },
        { status: 400 }
      );
    }

    // Crear el nuevo status
    const newStatus = await createStatus({
      statusId: body.statusId,
      name: body.name,
      description: body.description,
      ...(body.color && { color: body.color }) // Incluir color solo si está presente
    });

    return NextResponse.json({
      success: true,
      data: newStatus,
      message: 'Status creado correctamente'
    }, { status: 201 });

  } catch (error) {
    console.error('Error al crear status:', error);

    // Manejar error específico de statusId duplicado
    if (error instanceof Error && error.message.includes('Ya existe un status con statusId')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Status duplicado',
          message: error.message
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
