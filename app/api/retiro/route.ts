import { NextRequest, NextResponse } from "next/server";
import { getLeadInfo, updateLeadCustomFields, type KommoApiConfig } from "@/lib/kommo-api";
import { parseWebhookData } from "@/lib/webhook-utils";
import { getAllSettings } from "@/lib/mongodb-services";

export async function POST(request: NextRequest) {
  let leadId = 'unknown';

  try {
    // Parsear datos del webhook usando función unificada
    const parsedData = await parseWebhookData(request);
    leadId = parsedData.leadId;

    // Configurar API de Kommo
    const config: KommoApiConfig = {
      subdomain: process.env.KOMMO_SUBDOMAIN || "",
    };

    if (!config.subdomain) {
      console.error('❌ KOMMO_SUBDOMAIN not configured');
      return NextResponse.json({
        error: 'Kommo subdomain not configured',
        leadId
      }, { status: 500 });
    }

    // Obtener información del lead
    console.log(`🔍 Getting lead info for lead ${leadId}`);
    const leadInfo = await getLeadInfo(leadId, config);

    if (!leadInfo) {
      console.error(`❌ Failed to get lead info for lead ${leadId}`);
      return NextResponse.json({
        success: false,
        error: 'Failed to get lead information',
        leadId
      }, { status: 500 });
    }

    const leadName = leadInfo.name;
    console.log(`✅ Lead info obtained. Name: ${leadName}`);

    // Obtener settings para el walink (phone)
    console.log(`🔍 Getting settings for walink`);
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

    console.log(`✅ Phone number obtained: ${phoneNumber}`);

    // Generar el mensaje de wa.link
    const message = `Solicito retiro mi nombre de usuario es: ${leadName}. Quiero retirar todo!`;
    const waLink = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

    console.log(`🔗 Generated wa.link: ${waLink}`);

    // Actualizar el campo personalizado del lead (ID 977361)
    const customFieldsValues = [
      {
        field_id: 977361,
        values: [
          {
            value: waLink
          }
        ]
      }
    ];

    console.log(`🔄 Updating lead custom field 977361 with wa.link`);
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

    console.log(`✅ Lead custom field updated successfully for lead ${leadId}`);

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
    console.error(`❌ Error in retiro process for lead ${leadId}:`, error);

    // Devolver respuesta de error con detalles
    return NextResponse.json({
      success: false,
      error: "Failed to process retiro request",
      leadId: leadId,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}