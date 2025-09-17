import { NextRequest, NextResponse } from 'next/server';
import { getAllSettings, getSettingsById, updateSettingsById, SettingsDocument } from '../../../lib/mongodb-services';

// GET - Obtener todos los documentos de settings
export async function GET(request: NextRequest) {
  try {
    const settings = await getAllSettings();

    return NextResponse.json({
      success: true,
      data: settings,
      count: settings.length
    });

  } catch (error) {
    console.error('Error al obtener settings:', error);
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

// PUT - Actualizar un documento de settings específico
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar que se proporcione el ID
    if (!body.id) {
      return NextResponse.json(
        {
          success: false,
          error: 'ID requerido',
          message: 'Debe proporcionar el ID del documento a actualizar'
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
    const updatedSetting = await updateSettingsById(body.id, updateData);

    if (!updatedSetting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Documento no encontrado',
          message: `No se encontró un documento con el ID: ${body.id}`
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
    console.error('Error al actualizar settings:', error);
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
