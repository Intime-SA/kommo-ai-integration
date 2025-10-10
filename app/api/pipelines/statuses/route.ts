import { KOMMO_CONFIG } from '@/lib/kommo-config';
import { NextRequest, NextResponse } from 'next/server';



// Interface para la respuesta filtrada de status
interface FilteredStatus {
  id: number;
  name: string;
  color: string;
  pipeline_id: number;
}

export async function GET(request: NextRequest) {
  try {

    // Obtener el pipeline_id de los parámetros de query
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipeline_id');

    // Validar que se proporcione pipeline_id
    if (!pipelineId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetro requerido faltante',
          message: 'Debe proporcionar el parámetro pipeline_id en la query string (?pipeline_id=123456)'
        },
        { status: 400 }
      );
    }

    // Validar que ACCESS_TOKEN esté configurado
    if (!KOMMO_CONFIG.accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuración faltante',
          message: 'KOMMO_ACCESS_TOKEN no está configurado en las variables de entorno'
        },
        { status: 500 }
      );
    }

    // Validar que KOMMO_SUBDOMAIN esté configurado
    if (!KOMMO_CONFIG.subdomain) {
      return NextResponse.json(
        {
          success: false,
          error: 'Configuración faltante',
          message: 'KOMMO_SUBDOMAIN no está configurado en las variables de entorno'
        },
        { status: 500 }
      );
    }

    // Construir la URL de la API de Kommo
    const url = `https://${KOMMO_CONFIG.subdomain}.kommo.com/api/v4/leads/pipelines/${pipelineId}`;

    // Hacer la petición a la API de Kommo
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KOMMO_CONFIG.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error en API de Kommo: ${response.status} ${response.statusText}`, errorText);
      return NextResponse.json(
        {
          success: false,
          error: 'Error en API de Kommo',
          message: `Error al consultar pipeline ${pipelineId}: ${response.status} ${response.statusText}`,
          details: errorText
        },
        { status: response.status }
      );
    }

    const kommoResponse = await response.json();

    // Verificar que la respuesta tenga la estructura esperada
    if (!kommoResponse._embedded || !kommoResponse._embedded.statuses) {
      return NextResponse.json(
        {
          success: false,
          error: 'Respuesta inválida',
          message: 'La API de Kommo no devolvió la estructura esperada de statuses'
        },
        { status: 500 }
      );
    }

    // Filtrar y mapear los statuses según los requerimientos
    const filteredStatuses: FilteredStatus[] = kommoResponse._embedded.statuses.map((status: any) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      pipeline_id: status.pipeline_id
    }));

    return NextResponse.json({
      success: true,
      pipeline_id: parseInt(pipelineId),
      pipeline_name: kommoResponse.name || 'Pipeline desconocido',
      statuses: filteredStatuses,
      total_statuses: filteredStatuses.length
    });

  } catch (error) {
    console.error('❌ Error interno del servidor:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido al consultar la API de Kommo'
      },
      { status: 500 }
    );
  }
}
