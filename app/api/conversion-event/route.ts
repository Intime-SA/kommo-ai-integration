import { NextRequest, NextResponse } from "next/server"
import { findSendMetaByLeadId, sendConversionToMeta, saveSendMetaRecord } from "@/lib/mongodb-services"

async function handleWebhook(request: NextRequest) {
  try {
    const body = await request.text()
    console.log("📥 Webhook de conversión recibido:", body)

    // Parsear form data (Kommo envía datos form-encoded)
    const formData = new URLSearchParams(body)
    const webhookData: any = {}

    // Parsear los datos del form en estructura similar al webhook-kommo
    for (const [key, value] of formData.entries()) {
      if (key.includes("leads[add][0]")) {
        if (!webhookData.leads) {
          webhookData.leads = { add: [{ id: "", name: "", status_id: "", responsible_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "" }] }
        }

        const field = key.replace("leads[add][0][", "").replace("]", "")
        ;(webhookData.leads.add[0] as any)[field] = value
      }

      if (key.includes("account[")) {
        if (!webhookData.account) {
          webhookData.account = {}
        }

        const field = key.replace("account[", "").replace("]", "")
        ;(webhookData.account as any)[field] = value
      }
    }

    console.log("📋 Datos parseados del webhook:", webhookData)

    // Extraer el leadId del webhook (del campo leads.add[0].id)
    const leadId = webhookData.leads?.add?.[0]?.id

    if (!leadId) {
      console.error("❌ No se encontró leadId en el webhook")
      return NextResponse.json({
        success: false,
        error: "No se encontró leadId en el webhook"
      }, { status: 400 })
    }

    console.log(`🔍 Buscando registro en send_meta para leadId: ${leadId}`)

    // Buscar el registro en send_meta por leadId
    const sendMetaRecord = await findSendMetaByLeadId(leadId)

    if (!sendMetaRecord) {
      console.log(`⚠️ No se encontró registro en send_meta para leadId: ${leadId}`)
      return NextResponse.json({
        success: false,
        message: `No se encontró registro en send_meta para leadId: ${leadId}`
      }, { status: 404 })
    }

    console.log(`✅ Registro encontrado en send_meta para leadId: ${leadId}`)

    // Extraer los datos necesarios del registro encontrado
    const metaData = sendMetaRecord
    const originalUserData = metaData.conversionData[0]?.data[0]?.user_data

    if (!originalUserData) {
      console.error("❌ No se encontraron datos de usuario en el registro send_meta")
      return NextResponse.json({
        success: false,
        error: "No se encontraron datos de usuario en el registro send_meta"
      }, { status: 400 })
    }

    // Crear nueva conversión con event_name "CargoCRM1"
    const cargoConversionData = {
      data: [
        {
          event_name: "CargoCRM1", // Evento específico para status "Cargo"
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: metaData.conversionData[0].data[0].event_source_url,
          user_data: {
            client_ip_address: originalUserData.client_ip_address,
            client_user_agent: originalUserData.client_user_agent,
            fbp: originalUserData.fbp,
            fbc: originalUserData.fbc,
          }
        }
      ]
    }

    // Enviar conversión a Meta API
    const metaAccessToken = process.env.META_ACCESS_TOKEN
    if (!metaAccessToken) {
      console.error("❌ META_ACCESS_TOKEN no configurado")
      return NextResponse.json({
        success: false,
        error: "META_ACCESS_TOKEN no configurado"
      }, { status: 500 })
    }

    const conversionResult = await sendConversionToMeta(
      {
        ip: originalUserData.client_ip_address,
        userAgent: originalUserData.client_user_agent,
        fbp: originalUserData.fbp,
        fbc: originalUserData.fbc,
        eventSourceUrl: metaData.conversionData[0].data[0].event_source_url,
        extractedCode: metaData.extractedCode,
        eventName: "CargoCRM1" // Especificar que es CargoCRM1
      },
      metaAccessToken
    )

    // Verificar si la conversión se envió exitosamente (no fue duplicada)
    if (!conversionResult.success) {
      if (conversionResult.error === "DUPLICATE_CONVERSION") {
        console.log(`⚠️ Conversión duplicada detectada para CargoCRM1 con código: ${metaData.extractedCode}`)
        return NextResponse.json({
          success: true,
          message: `Conversión CargoCRM1 ya enviada anteriormente para código: ${metaData.extractedCode}`,
          duplicate_conversion: true
        })
      } else {
        console.error(`❌ Error al enviar conversión CargoCRM1 para código ${metaData.extractedCode}:`, conversionResult.error)
        return NextResponse.json({
          success: false,
          error: `Error al enviar conversión CargoCRM1: ${conversionResult.error}`
        }, { status: 500 })
      }
    }

    // Preparar datos para guardar en send_meta
    const messageData = {
      id: `conversion_webhook_${leadId}_${Date.now()}`,
      chatId: metaData.messageData.chatId,
      talkId: metaData.messageData.talkId,
      contactId: metaData.messageData.contactId,
      text: `Webhook conversion trigger for CargoCRM1`,
      createdAt: new Date().toISOString(),
      elementType: "webhook",
      entityType: "conversion",
      elementId: leadId,
      entityId: leadId,
      type: "webhook",
      author: {
        name: "System",
        id: "webhook"
      }
    }

    // Guardar registro en colección send_meta
    // Array con [1] = CargoCRM1 (solo cargo, sin conversación previa)
    const saveResult = await saveSendMetaRecord(
      [null, cargoConversionData],
      messageData,
      metaData.extractedCode, // Usar el mismo código original
      [null, conversionResult]
    )

    if (saveResult.success) {
      console.log(`💾 Registro actualizado en send_meta para webhook conversion Cargo: ${leadId}`)
    } else {
      console.error(`❌ Error al guardar en send_meta para webhook conversion ${leadId}:`, saveResult.error)
    }

    if (conversionResult.success) {
      console.log(`🎉 Conversión "CargoCRM1" enviada exitosamente para webhook lead: ${leadId}`)
      return NextResponse.json({
        success: true,
        message: `Conversión CargoCRM1 enviada exitosamente para lead: ${leadId}`,
        leadId: leadId,
        extractedCode: metaData.extractedCode
      })
    } else {
      console.error(`❌ Error al enviar conversión "CargoCRM1" para webhook lead ${leadId}:`, conversionResult.error)
      return NextResponse.json({
        success: false,
        error: `Error al enviar conversión CargoCRM1: ${conversionResult.error}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error("❌ Error al procesar webhook de conversión:", error)
    return NextResponse.json({
      success: false,
      error: "Error interno del servidor",
      details: error instanceof Error ? error.message : "Error desconocido"
    }, { status: 500 })
  }
}

export const POST = handleWebhook
export const GET = handleWebhook    