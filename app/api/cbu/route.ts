import { NextRequest, NextResponse } from "next/server";
import { getAllSettings } from "../../../lib/mongodb-services";

async function sendCbuMessage(leadId: string, subdomain: string, cbu: string) {
  // Función para enviar un mensaje con el CBU al lead via WhatsApp
  const KOMMO_TOKEN = process.env.KOMMO_ACCESS_TOKEN; // Usar el mismo token que tenemos

  if (!KOMMO_TOKEN) {
    throw new Error("KOMMO_ACCESS_TOKEN no está configurado");
  }

  // Primero necesitamos obtener la conversación (chat) del lead
  const chatUrl = `https://${subdomain}.kommo.com/api/v4/leads/${leadId}?with=contacts`;

  const chatResponse = await fetch(chatUrl, {
    headers: {
      Authorization: `Bearer ${KOMMO_TOKEN}`,
    },
  });

  if (!chatResponse.ok) {
    throw new Error(`Error al obtener información del lead: ${chatResponse.status}`);
  }

  const leadData = await chatResponse.json();

  // Extraer el contact_id del lead
  const contactId = leadData._embedded?.contacts?.[0]?.id;

  if (!contactId) {
    throw new Error("No se pudo encontrar el contact_id del lead");
  }

  // Ahora enviar mensaje usando la API de mensajes
  const messageUrl = `https://${subdomain}.kommo.com/api/v4/chats`;

  const payload = {
    contact_id: contactId,
    message: {
      type: "text",
      text: cbu // Solo el CBU, sin texto adicional
    },
    channel_id: 1 // Canal de WhatsApp (ajustar según tu configuración)
  };

  console.log(`📤 Enviando mensaje con CBU a lead ${leadId} (contacto ${contactId}):`, cbu);

  const res = await fetch(messageUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KOMMO_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ Error al enviar mensaje con CBU: ${res.status} ${res.statusText}`, errorText);
    throw new Error(`Error en API de Kommo: ${res.status} ${res.statusText}`);
  }

  const result = await res.json();
  console.log("✅ Mensaje con CBU enviado exitosamente:", result);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    // Leer el body como texto plano
    const formData = await request.text();
    console.log("Raw body recibido:", formData);

    // Parsear application/x-www-form-urlencoded
    const params = new URLSearchParams(formData);
    const data = Object.fromEntries(params);

    console.log("Body parseado:", data);

    // Extraer datos del webhook
    const leadId = data['leads[add][0][id]'];
    const subdomain = data['account[subdomain]'];

    if (!leadId || !subdomain) {
      console.error("❌ Datos requeridos faltantes:", { leadId, subdomain });
      return NextResponse.json({
        success: false,
        error: "Datos requeridos faltantes",
        message: "No se encontró leadId o subdomain en el webhook"
      }, { status: 400 });
    }

    // Consultar settings para obtener el CBU actualizado
    console.log("🔍 Consultando settings para obtener CBU...");
    const settings = await getAllSettings();

    if (!settings || settings.length === 0) {
      console.error("❌ No se encontraron settings");
      return NextResponse.json({
        success: false,
        error: "Settings no encontrados",
        message: "No hay configuración de CBU disponible"
      }, { status: 404 });
    }

    // Obtener el CBU del primer setting (asumiendo que hay uno principal)
    const accountCBU = settings[0].accountCBU;

    if (!accountCBU) {
      console.error("❌ CBU no encontrado en settings");
      return NextResponse.json({
        success: false,
        error: "CBU no configurado",
        message: "El CBU no está configurado en los settings"
      }, { status: 404 });
    }

    console.log(`✅ CBU obtenido: ${accountCBU}`);

    // Enviar el mensaje con el CBU
    await sendCbuMessage(leadId, subdomain, accountCBU);

    return NextResponse.json({
      success: true,
      message: "Mensaje con CBU enviado exitosamente",
      data: {
        leadId,
        cbu: accountCBU,
        subdomain
      }
    });

  } catch (error) {
    console.error("❌ Error en endpoint CBU:", error);
    return NextResponse.json({
      success: false,
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 });
  }
}
