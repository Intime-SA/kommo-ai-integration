import { NextRequest, NextResponse } from 'next/server';
import { getSettingsById, updateSettingsById, SettingsDocument } from '../../../../lib/mongodb-services';

// GET - Obtener un documento de settings específico por ID
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

    const setting = await getSettingsById(id);

    if (!setting) {
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
      data: setting
    });

  } catch (error) {
    console.error('Error al obtener setting específico:', error);
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

// PUT - Actualizar un documento de settings específico por ID (desde la URL)
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
    const updateFields = ['accountCBU', 'context', 'message'];
    const hasValidField = updateFields.some(field => body[field] !== undefined);

    if (!hasValidField) {
      return NextResponse.json(
        {
          success: false,
          error: 'Campos requeridos',
          message: 'Debe proporcionar al menos uno de los campos: accountCBU, context, message'
        },
        { status: 400 }
      );
    }

    // Preparar los datos de actualización
    const updateData: Partial<Omit<SettingsDocument, '_id'>> = {};
    if (body.accountCBU !== undefined) updateData.accountCBU = body.accountCBU;
    if (body.context !== undefined) updateData.context = body.context;
    if (body.message !== undefined) updateData.message = body.message;

    // Actualizar el documento
    const updatedSetting = await updateSettingsById(id, updateData);

    if (!updatedSetting) {
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
      data: updatedSetting,
      message: 'Documento actualizado correctamente'
    });

  } catch (error) {
    console.error('Error al actualizar setting específico:', error);
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
