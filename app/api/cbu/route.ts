import { NextRequest, NextResponse } from "next/server";
import { getAllSettings } from "../../../lib/mongodb-services";
import { updateLeadCustomFields, KommoApiConfig } from "../../../lib/kommo-api";



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
    const accountName = settings[0].accountName;
    console.log("accountName", accountName);
    console.log("accountCBU", accountCBU);

    if (!accountCBU) {
      console.error("❌ CBU no encontrado en settings");
      return NextResponse.json({
        success: false,
        error: "CBU no configurado",
        message: "El CBU no está configurado en los settings"
      }, { status: 404 });
    }

    console.log(`✅ CBU obtenido: ${accountCBU}`);

    // SETEAR CBU COMO UN CUSTOM FIELD en el lead
    console.log(`🔄 Actualizando custom field del lead ${leadId} con CBU...`);

    const customFieldsValues = [
      {
        field_id: 977357,
        values: [
          {
            value: accountCBU
          }
        ]
      },
      {
        field_id: 977359,
        values: [
          {
            value: accountName
          }
        ]
      }
    ];

    const config: KommoApiConfig = { subdomain };

    const updateSuccess = await updateLeadCustomFields(leadId, customFieldsValues, config);

    if (!updateSuccess) {
      console.error("❌ Error al actualizar el custom field del lead");
      return NextResponse.json({
        success: false,
        error: "Error al actualizar custom field",
        message: "No se pudo actualizar el campo personalizado del lead"
      }, { status: 500 });
    }

    console.log(`✅ Custom field actualizado exitosamente en lead ${leadId}`);

    return NextResponse.json({
      success: true,
      message: "Custom field del lead actualizado exitosamente con el CBU",
      data: {
        leadId,
        cbu: accountCBU,
        accountName: accountName,
        subdomain,
        fieldId: 977357,
        fieldIdName: 977359
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
