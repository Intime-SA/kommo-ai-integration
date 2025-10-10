import { NextRequest, NextResponse } from "next/server";
import { getAllSettings } from "../../../lib/mongodb-services";
import { updateLeadCustomFields, KommoApiConfig } from "../../../lib/kommo-api";
import { KOMMO_CONFIG } from "@/lib/kommo-config";



export async function POST(request: NextRequest) {
  try {
    // Leer el body como texto plano
    const formData = await request.text();

    // Parsear application/x-www-form-urlencoded
    const params = new URLSearchParams(formData);
    const data = Object.fromEntries(params);

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


    // Validar que el CBU esté configurado
    if (!accountCBU) {
      console.error("❌ CBU no encontrado en settings");
      return NextResponse.json({
        success: false,
        error: "CBU no configurado",
        message: "El CBU no está configurado en los settings"
      }, { status: 404 });
    }

    // SETEAR CBU COMO UN CUSTOM FIELD en el lead
    const customFieldsValues = [
      {
        field_id: parseInt(KOMMO_CONFIG.customFields.idCbu || "0"),
        values: [
          {
            value: accountCBU
          }
        ]
      },
      {
        field_id: parseInt(KOMMO_CONFIG.customFields.idTitularAccount || "0"),
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

    return NextResponse.json({
      success: true,
      message: "Custom field del lead actualizado exitosamente con el CBU",
      data: {
        leadId,
        cbu: accountCBU,
        accountName: accountName,
        subdomain,
        fieldId: KOMMO_CONFIG.customFields.idCbu,
        fieldIdName: KOMMO_CONFIG.customFields.idTitularAccount
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
