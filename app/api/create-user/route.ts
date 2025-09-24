import { NextRequest, NextResponse } from "next/server";
import { createUserFromLead, updateLeadName, type KommoApiConfig } from "@/lib/kommo-api";

export async function POST(request: NextRequest) {
  let body: Record<string, any>;

  try {
    // Leer el body como texto primero para evitar el problema de "body already read"
    const text = await request.text();

    if (!text) {
      return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
    }

    // Intentar parsear como JSON primero
    try {
      body = JSON.parse(text);
    } catch (jsonError) {
      // Si falla, intentar parsear como form data URL-encoded
      try {
        const params = new URLSearchParams(text);
        body = {};
        for (const [key, value] of params.entries()) {
          // Intentar parsear valores como JSON si es posible
          try {
            body[key] = JSON.parse(value);
          } catch {
            body[key] = value;
          }
        }
      } catch (formError) {
        console.error('Error parsing request body as form data:', formError);
        return NextResponse.json({ error: 'Invalid request body format' }, { status: 400 });
      }
    }
  } catch (error) {
    console.error('Error reading request body:', error);
    return NextResponse.json({ error: 'Unable to read request body' }, { status: 400 });
  }

  console.log('Parsed webhook body:', body);

  // Extraer leadId del webhook data
  // El webhook puede venir con diferentes formatos, buscar leadId en varios lugares
  let leadId: string | null = null;

  // Buscar leadId en diferentes formatos posibles
  if (body.leadId) {
    leadId = body.leadId.toString();
  } else if (body.lead_id) {
    leadId = body.lead_id.toString();
  } else if (body.id) {
    leadId = body.id.toString();
  } else if (body['leads[id]']) {
    leadId = body['leads[id]'].toString();
  } else if (body['leads[add][0][id]']) {
    // Formato específico del webhook: leads[add][0][id]
    leadId = body['leads[add][0][id]'].toString();
  } else if (body.leads && typeof body.leads === 'object') {
    // Si viene como objeto leads
    if (Array.isArray(body.leads) && body.leads.length > 0) {
      leadId = body.leads[0].id?.toString();
    } else if (body.leads.id) {
      leadId = body.leads.id.toString();
    }
  }

  if (!leadId) {
    console.error('❌ No leadId found in webhook data:', body);
    return NextResponse.json({
      error: 'Lead ID not found in webhook data',
      receivedData: body
    }, { status: 400 });
  }

  console.log(`🎯 Webhook received for lead ID: ${leadId}`);

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

  // Ejecutar el proceso de creación de usuario en paralelo (background)
  processUserCreationAsync(leadId, config, body);

  // Devolver respuesta inmediata al webhook (dentro de 2 segundos)
  console.log(`✅ Webhook acknowledged for lead ${leadId} - processing in background`);
  return NextResponse.json({
    success: true,
    message: "Webhook received and user creation started",
    leadId: leadId,
    status: "processing"
  });
}

// Función para procesar la creación de usuario en background
async function processUserCreationAsync(leadId: string, config: KommoApiConfig, originalBody: Record<string, any>) {
  try {
    console.log(`🚀 Starting background user creation process for lead ${leadId}`);

    // Ejecutar el proceso completo de creación de usuario
    const result = await createUserFromLead(leadId, config);

    console.log('✅ User creation completed successfully in background:', {
      leadId: result.leadId,
      contactId: result.contactId,
      username: result.username
    });

    // Verificar si la respuesta de la API de registro fue exitosa
    const registrationResponse = result.registrationResult;

    if (registrationResponse && registrationResponse.success === true) {
      console.log(`🔄 Registration successful, updating lead name to username: ${result.username}`);

      // Actualizar el nombre del lead con el username
      const nameUpdateSuccess = await updateLeadName(leadId, result.username, config);

      if (nameUpdateSuccess) {
        console.log(`✅ Lead name updated successfully to: ${result.username}`);
      } else {
        console.error(`❌ Failed to update lead name for lead ${leadId}`);
      }
    } else {
      console.log(`⚠️ Registration was not successful, skipping lead name update. Response:`, registrationResponse);
    }

  } catch (error) {
    console.error(`❌ Error in background user creation process for lead ${leadId}:`, error);

    // Aquí podrías agregar lógica de manejo de errores como:
    // - Reintentar la operación
    // - Notificar a administradores
    // - Actualizar status de error en Kommo
    // - etc.
  }
}