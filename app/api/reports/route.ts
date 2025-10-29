import { NextRequest, NextResponse } from "next/server";
import { getReports } from "@/lib/mongodb-services";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get('campaignId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const eventName = searchParams.get('eventName') || undefined;
    const eventSourceUrl = searchParams.get('eventSourceUrl') || undefined;

    console.log('📊 Generando reportes con filtros:', {
      campaignId,
      startDate,
      endDate,
      eventName,
      eventSourceUrl
    });

    const reports = await getReports(campaignId, startDate, endDate, eventName, eventSourceUrl);

    console.log('✅ Reportes generados exitosamente:', reports);

    return NextResponse.json({
      success: true,
      data: reports,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error generando reportes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}