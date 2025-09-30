import { NextRequest, NextResponse } from "next/server";
import { createUserFromLead, updateLeadName, type KommoApiConfig } from "@/lib/kommo-api";
import { parseWebhookData } from "@/lib/webhook-utils";

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

    // Ejecutar el proceso completo de creación de usuario
    console.log(`🚀 Starting user creation process for lead ${leadId}`);
    const result = await createUserFromLead(leadId, config);

    console.log('✅ User creation completed successfully:', {
      leadId: result.leadId,
      contactId: result.contactId,
      username: result.username
    });

    // Verificar si la respuesta de la API de registro fue exitosa
    const registrationResponse = result.registrationResult;

    let leadNameUpdated = false;
    if (registrationResponse && registrationResponse.success === true) {
      console.log(`🔄 Registration successful, updating lead name to username: ${result.username}`);

      // Actualizar el nombre del lead con el username
      leadNameUpdated = await updateLeadName(leadId, result.username, config);

      if (leadNameUpdated) {
        console.log(`✅ Lead name updated successfully to: ${result.username}`);
      } else {
        console.error(`❌ Failed to update lead name for lead ${leadId}`);
      }
    } else {
      console.log(`⚠️ Registration was not successful, skipping lead name update. Response:`, registrationResponse);
    }

    // Devolver respuesta exitosa con detalles del proceso
    return NextResponse.json({
      success: true,
      message: "User creation completed successfully",
      leadId: leadId,
      contactId: result.contactId,
      username: result.username,
      leadNameUpdated: leadNameUpdated,
      registrationResult: registrationResponse
    });

  } catch (error) {
    console.error(`❌ Error in user creation process for lead ${leadId}:`, error);

    // Devolver respuesta de error con detalles
    return NextResponse.json({
      success: false,
      error: "Failed to create user",
      leadId: leadId,
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}