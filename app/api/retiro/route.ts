import { NextRequest, NextResponse } from "next/server";
import { getLeadInfo, updateLeadCustomFields, type KommoApiConfig } from "@/lib/kommo-api";
import { parseWebhookData } from "@/lib/webhook-utils";
import { getAllSettings } from "@/lib/mongodb-services";
import { KOMMO_CONFIG } from "@/lib/kommo-config";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  let leadId = 'unknown';
  let leadName = 'unknown';

  try {
    // Parsear datos del webhook usando función unificada
    const { leadId } = await parseWebhookData(request);

    // Configurar API de Kommo
    const config: KommoApiConfig = {
      subdomain: KOMMO_CONFIG.subdomain || "",
    };

    // Obtener información del lead
    const leadInfo = await getLeadInfo(leadId, config);

    if (!leadInfo) {
      console.error(`❌ Failed to get lead info for lead ${leadId}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to get lead information',
        leadId
      }, { status: 500 });
    }

    leadName = leadInfo.name;

    // Obtener settings para el walink (phone)
    const settings = await getAllSettings();

    if (!settings || settings.length === 0) {
      console.error('❌ No settings found');
      return NextResponse.json({
        success: false,
        error: 'Settings not found',
        leadId
      }, { status: 500 });
    }

    // Tomar el primer setting (asumiendo que hay solo uno)
    const setting = settings[0];
    const phoneNumber = setting.walink;

    if (!phoneNumber) {
      console.error('❌ walink (phone number) not configured in settings');
      return NextResponse.json({
        success: false,
        error: 'Phone number not configured in settings',
        leadId
      }, { status: 500 });
    }

    // Generar el mensaje de wa.link
    const message = `Solicito retiro mi nombre de usuario es: ${leadName}. Quiero retirar todo!`;
    const waLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;


    // Actualizar el campo personalizado del lead (ID 977361)
    const customFieldsValues = [
      {
        name: KOMMO_CONFIG.customFields.tagWalink,
        field_id: KOMMO_CONFIG.customFields.idWalink,
        values: [
          {
            value: waLink
          }
        ]
      }
    ];

    const updateSuccess = await updateLeadCustomFields(leadId, customFieldsValues, config);

    if (!updateSuccess) {
      console.error(`❌ Failed to update lead custom field for lead ${leadId}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to update lead custom field',
        leadId,
        waLink
      }, { status: 500 });
    }

    // Devolver respuesta exitosa
    return NextResponse.json({
      success: true,
      message: "Retiro process completed successfully",
      leadId: leadId,
      leadName: leadName,
      waLink: waLink,
      customFieldUpdated: true
    });

  } catch (error) {
    logger.error(`❌ Error in retiro process for lead ${leadId}:`, error);

    // Devolver respuesta de error con detalles
    return NextResponse.json({
      success: false,
      error: "Failed to process retiro request",
      leadId: leadId,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}