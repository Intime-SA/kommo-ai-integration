import { NextRequest } from "next/server";

export interface ParsedWebhookData {
  leadId: string;
  body: Record<string, any>;
}

/**
 * Función unificada para parsear y logear datos del webhook
 * Reutilizable entre diferentes endpoints que reciben el mismo formato
 */
export async function parseWebhookData(request: NextRequest): Promise<ParsedWebhookData> {
  let body: Record<string, any>;

  try {
    // Leer el body como texto primero para evitar el problema de "body already read"
    const text = await request.text();

    if (!text) {
      throw new Error('Empty request body');
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
        throw new Error('Invalid request body format');
      }
    }
  } catch (error) {
    console.error('Error reading request body:', error);
    throw new Error('Unable to read request body');
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
    throw new Error('Lead ID not found in webhook data');
  }

  console.log(`🎯 Webhook received for lead ID: ${leadId}`);

  return { leadId, body };
}
