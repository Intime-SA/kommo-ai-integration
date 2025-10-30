import { NextRequest, NextResponse } from "next/server";
import { getReportsStats } from "@/lib/mongodb-services";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const eventName = searchParams.get('eventName') || undefined;
    const eventSourceUrl = searchParams.get('eventSourceUrl') || undefined;
    const groupByParam = searchParams.get('groupBy') || undefined;

    console.log('📊 Generando estadísticas para gráficos con filtros:', {
      campaignId,
      startDate,
      endDate,
      eventName,
      eventSourceUrl,
      groupByParam
    });

    // Determinar automáticamente el tipo de agrupación si no se especifica
    let groupBy: 'dayOfWeek' | 'date' | 'month' = 'date';

    if (groupByParam) {
      // Si se especifica explícitamente, usar ese valor
      groupBy = groupByParam as 'dayOfWeek' | 'date' | 'month';
    } else if (startDate && endDate) {
      // Determinar automáticamente basado en el rango de fechas
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 7) {
        groupBy = 'dayOfWeek'; // Para rangos pequeños, agrupar por día de la semana
      } else if (diffDays > 90) {
        groupBy = 'month'; // Para rangos grandes, agrupar por mes
      } else {
        groupBy = 'date'; // Para rangos medianos, agrupar por fecha
      }
    }

    console.log(`📅 Usando agrupación: ${groupBy}`);

    const stats = await getReportsStats(campaignId, startDate, endDate, eventName);

    console.log('✅ Estadísticas para gráficos generadas exitosamente');

    return NextResponse.json({
      data: stats,
      status: 200
    });

  } catch (error) {
    console.error('❌ Error generando estadísticas para gráficos:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error desconocido',
        status: 500
      },
      { status: 500 }
    );
  }
}
