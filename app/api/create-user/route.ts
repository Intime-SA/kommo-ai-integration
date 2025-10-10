import { NextRequest, NextResponse } from "next/server";
import {
  createUserFromLead,
  updateLeadCustomFields,
  updateLeadName,
  type KommoApiConfig,
} from "@/lib/kommo-api";
import { parseWebhookData } from "@/lib/webhook-utils";
import { KOMMO_CONFIG } from "@/lib/kommo-config";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  let leadId = "unknown";
  let leadNameUpdated = false;

  // Extraer parámetro platform de la query string
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform') as 'greenBet' | 'moneyMaker'; // default a greenBet si no se especifica

  try {

    // Parsear datos del webhook usando función unificada
    const { leadId } = await parseWebhookData(request);

    // Configurar API de Kommo
    const config: KommoApiConfig = {
      subdomain: KOMMO_CONFIG.subdomain || "",
    };

    // Ejecutar el proceso completo de creación de usuario
    const result = await createUserFromLead(leadId, config, platform);
    console.log(result, 'RESULTADO EZE');

    // Verificar si la respuesta de la API de registro fue exitosa
    const registrationResponse = result.registrationResult;

    // Actualizar el nombre del lead con el username
    if (registrationResponse && registrationResponse.success === true) {
      leadNameUpdated = await updateLeadName(leadId, result.username, config);
      if (platform === "moneyMaker") {

        const customFieldsValues = [
          {
            field_id: parseInt(KOMMO_CONFIG.customFields.idRegisterLink || "0"),
            values: [
              {
                value: registrationResponse.url
              }
            ]
          }
        ];
        const updateSuccess = await updateLeadCustomFields(
          leadId,
          customFieldsValues,
          config
        )
        if (!updateSuccess) {
          logger.error(`❌ Failed to update lead custom field for lead ${leadId}`);
          return NextResponse.json({
            success: false,
            error: 'Failed to update lead custom field',
            leadId: leadId,
            registrationResult: registrationResponse
          }, { status: 500 });
        }
      }
    } else {
      logger.info(
        `⚠️ Registration was not successful, skipping lead name update. Response:`,
        registrationResponse
      );
    }

    // Devolver respuesta exitosa con detalles del proceso
    return NextResponse.json({
      success: true,
      message: "User creation completed successfully",
      leadId: leadId,
      contactId: result.contactId,
      username: result.username,
      platform: platform,
      leadNameUpdated: leadNameUpdated,
      registrationResult: registrationResponse,
    });
  } catch (error) {
    logger.error(
      `❌ Error in user creation process for lead ${leadId}:`,
      error
    );

    // Devolver respuesta de error con detalles
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create user",
        leadId: leadId,
        platform: platform,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
