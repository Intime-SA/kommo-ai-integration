import { NextRequest, NextResponse } from 'next/server';
import { getStatusById, updateStatusById, deleteStatusById, StatusDocument } from '../../../../lib/mongodb-services';

// GET - Obtener un documento de status específico por ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID requerido',
          message: 'Debe proporcionar un ID válido'
        },
        { status: 400 }
      );
    }

    const status = await getStatusById(id);

    if (!status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documento no encontrado',
          message: `No se encontró un documento con el ID: ${id}`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error al obtener status específico:', error);
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

// PUT - Actualizar un documento de status específico por ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID requerido',
          message: 'Debe proporcionar un ID válido en la URL'
        },
        { status: 400 }
      );
    }

    // Validar que al menos uno de los campos actualizables esté presente
    const updateFields = ['statusId', 'name', 'description', 'kommo_id', 'color'];
    const hasValidField = updateFields.some(field => body[field] !== undefined);

    if (!hasValidField) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos requeridos',
          message: 'Debe proporcionar al menos uno de los campos: statusId, name, description, kommo_id, color'
        },
        { status: 400 }
      );
    }

    // Validar tipos de datos si están presentes
    if (body.statusId !== undefined && typeof body.statusId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de dato inválido',
          message: 'statusId debe ser un string'
        },
        { status: 400 }
      );
    }

    if (body.name !== undefined && typeof body.name !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de dato inválido',
          message: 'name debe ser un string'
        },
        { status: 400 }
      );
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de dato inválido',
          message: 'description debe ser un string'
        },
        { status: 400 }
      );
    }

    if (body.kommo_id !== undefined && body.kommo_id !== null && typeof body.kommo_id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Tipo de dato inválido',
          message: 'kommo_id debe ser un string o null'
        },
        { status: 400 }
      );
    }

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

    // Preparar los datos de actualización
    const updateData: Partial<Omit<StatusDocument, '_id' | 'createdAt'>> = {};
    if (body.statusId !== undefined) updateData.statusId = body.statusId;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.kommo_id !== undefined) updateData.kommo_id = body.kommo_id;
    if (body.color !== undefined) updateData.color = body.color;

    // Actualizar el documento
    const updatedStatus = await updateStatusById(id, updateData);

    if (!updatedStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documento no encontrado',
          message: `No se encontró un documento con el ID: ${id}`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedStatus,
      message: 'Status actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar status específico:', error);
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

// DELETE - Eliminar un documento de status específico por ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID requerido',
          message: 'Debe proporcionar un ID válido en la URL'
        },
        { status: 400 }
      );
    }

    const deleted = await deleteStatusById(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documento no encontrado',
          message: `No se encontró un documento con el ID: ${id}`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Status eliminado correctamente'
    });

  } catch (error) {
    console.error('Error al eliminar status específico:', error);
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
