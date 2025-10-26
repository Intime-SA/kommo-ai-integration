import { NextResponse } from "next/server";
import { logger } from "../logger";
import { KOMMO_CONFIG } from "../kommo-config";

export function logPipelineError(pipelineId: string) {
  logger.error(
    `🚫 Webhook RECHAZADO: Pipeline ${pipelineId} no autorizado. Solo se procesan webhooks del pipeline ${KOMMO_CONFIG.pipelines[0].id}`
  );
  return NextResponse.json(
    {
      success: false,
      message: `Webhook rechazado: Pipeline ${pipelineId} no autorizado. Solo se procesan webhooks del pipeline 11862040`,
      pipeline_id: pipelineId,
      required_pipeline: KOMMO_CONFIG.pipelines[0].id,
    },
    { status: 200 }
  ); // 200 porque es un procesamiento válido pero rechazado
}
