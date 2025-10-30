import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDailyMeta } from "@/lib/mongodb-services";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date } = body;
    logger.info('📅 Procesando daily meta para fecha:', date);

    if (!date) {
      logger.error('❌ El campo "date" es requerido');
      return NextResponse.json(
        {
          success: false,
          error: "El campo 'date' es requerido",
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    logger.info('📅 Procesando daily meta para fecha:', date);

    const result = await getOrCreateDailyMeta(date);

    logger.info('✅ Daily meta procesado exitosamente:', result);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Error procesando daily meta:', error);
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
