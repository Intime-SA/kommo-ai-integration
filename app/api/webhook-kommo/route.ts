import { type NextRequest, NextResponse } from "next/server"
import type { KommoWebhookData, ProcessedMessage } from "@/types/kommo"
import { processMessageWithAI } from "@/lib/ai-processor"
import { updateLeadStatusByName, getCurrentLeadStatus, type KommoApiConfig } from "@/lib/kommo-api"

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook data
    const body = await request.text()
    console.log("🔔 Webhook recibido de Kommo (datos crudos):", body)

    // Parse form data (Kommo sends form-encoded data)
    const formData = new URLSearchParams(body)
    const webhookData: Partial<KommoWebhookData> = {}

    // Parse the form data into our structure
    for (const [key, value] of formData.entries()) {
      if (key.includes("message[add][0]")) {
        if (!webhookData.message) {
          webhookData.message = { add: [{ id: "", chat_id: "", talk_id: "", contact_id: "", text: "", created_at: "", element_type: "", entity_type: "", element_id: "", entity_id: "", type: "incoming", author: { id: "", type: "", name: "" } }] }
        }

        const field = key.replace("message[add][0][", "").replace("]", "")
        if (field.includes("[")) {
          // Handle nested fields like author[name]
          const [parentField, childField] = field.split("[")
          const cleanChildField = childField.replace("]", "")

          if (!webhookData.message.add[0][parentField as keyof (typeof webhookData.message.add)[0]]) {
            ;(webhookData.message.add[0] as any)[parentField] = {}
          }
          ;(webhookData.message.add[0] as any)[parentField][cleanChildField] = value
        } else {
          ;(webhookData.message.add[0] as any)[field] = value
        }
      }

      if (key.includes("talk[add][0]")) {
        if (!webhookData.talk) {
          webhookData.talk = { add: [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }] }
        }

        const field = key.replace("talk[add][0][", "").replace("]", "")
        ;(webhookData.talk.add[0] as any)[field] = value
      }

      if (key.includes("account[")) {
        if (!webhookData.account) {
          webhookData.account = {} as any
        }

        const field = key.replace("account[", "").replace("]", "")
        if (webhookData.account) {
          if (field === "_links][self") {
            if (!webhookData.account._links) {
              webhookData.account._links = {} as any
            }
            webhookData.account._links.self = value
          } else {
            ;(webhookData.account as any)[field] = value
          }
        }
      }
    }

    // Mostrar datos parseados de manera legible
    console.log("📋 Datos del webhook parseados:")
    console.log("- Cuenta:", webhookData.account ? {
      subdomain: webhookData.account.subdomain,
      id: webhookData.account.id,
      links: webhookData.account._links
    } : "No disponible")

    if (webhookData.message?.add?.[0]) {
      const msg = webhookData.message.add[0]
      console.log("- Mensaje:", {
        id: msg.id,
        chat_id: msg.chat_id,
        talk_id: msg.talk_id,
        contact_id: msg.contact_id,
        text: msg.text,
        created_at: new Date(Number.parseInt(msg.created_at) * 1000).toLocaleString('es-ES'),
        element_type: msg.element_type,
        entity_type: msg.entity_type,
        element_id: msg.element_id,
        entity_id: msg.entity_id,
        type: msg.type,
        author: msg.author,

        //origin: msg.origin
      })
    }

    if (webhookData.talk?.add?.[0]) {
      const talk = webhookData.talk.add[0]
      console.log("- Conversación:", {
        talk_id: talk.talk_id,
        contact_id: talk.contact_id,
        chat_id: talk.chat_id,
        entity_id: talk.entity_id,
        entity_type: talk.entity_type,
        origin: talk.origin,
        is_in_work: talk.is_in_work,
        is_read: talk.is_read
      })
    }

    // Process only incoming messages
    if (webhookData.message?.add?.[0]?.type === "incoming") {
      const message = webhookData.message.add[0]

      // Validar que el mensaje tenga texto antes de procesar
      if (!message.text || message.text.trim() === "") {
        console.log("⚠️ Mensaje sin texto - ignorando procesamiento")
        return NextResponse.json({
          success: true,
          processed: false,
          message: "Mensaje sin texto - no procesado",
        })
      }

      if (message.talk_id && message.entity_id) {
        console.log(`📨 Procesando mensaje: "${message.text}" de ${message.author?.name}`)

        // Obtener la configuración de Kommo
        const config: KommoApiConfig = {
          subdomain: process.env.KOMMO_SUBDOMAIN || "",
        }

        if (!config.subdomain) {
          console.warn("⚠️ Configuración de Kommo incompleta - no se puede procesar el lead")
          return NextResponse.json({
            success: false,
            processed: false,
            message: "Configuración de Kommo incompleta",
          })
        }

        // Obtener el status actual del lead desde Kommo
        console.log(`🔍 Consultando status actual del lead ${message.entity_id}...`)
        const currentStatus = await getCurrentLeadStatus(message.entity_id, config)

        if (!currentStatus) {
          console.warn(`⚠️ No se pudo obtener el status actual del lead ${message.entity_id}`)
          return NextResponse.json({
            success: false,
            processed: false,
            message: "No se pudo obtener el status del lead",
          })
        }

        console.log(`📊 Status actual del lead: "${currentStatus}"`)

        // Process with AI usando el status real
        const aiDecision = await processMessageWithAI(message.text, currentStatus, message.talk_id)

        const processedMessage: ProcessedMessage = {
          talkId: message.talk_id,
          contactId: message.contact_id,
          entityId: message.entity_id,
          messageText: message.text,
          authorName: message.author?.name || "Cliente",
          timestamp: new Date(Number.parseInt(message.created_at) * 1000).toISOString(),
          aiDecision,
        }

        console.log("🤖 Decisión de IA:", aiDecision)

        // Here you would typically:
        // 1. Save the processed message to your database
        // 2. If aiDecision.shouldChange is true, update the lead status in Kommo
        // 3. Log the activity for monitoring

        if (aiDecision.shouldChange) {
          console.log(`🔄 Cambiando status de "${aiDecision.currentStatus}" a "${aiDecision.newStatus}"`)
          console.log(`📝 Razón: ${aiDecision.reasoning}`)

          try {
            const updateSuccess = await updateLeadStatusByName(
              message.entity_id,
              aiDecision.newStatus as keyof typeof import("@/lib/kommo-api").STATUS_MAPPING,
              config
            )

            if (updateSuccess) {
              console.log(`✅ Lead ${message.entity_id} actualizado exitosamente a "${aiDecision.newStatus}"`)
            } else {
              console.error(`❌ Error actualizando lead ${message.entity_id} a "${aiDecision.newStatus}"`)
            }
          } catch (updateError) {
            console.error("❌ Error en la actualización del lead:", updateError)
          }
        }

        return NextResponse.json({
          success: true,
          processed: true,
          decision: aiDecision,
          currentStatus,
          message: "Mensaje procesado correctamente",
        })
      }
    }

    // For non-message webhooks or outgoing messages
    return NextResponse.json({
      success: true,
      processed: false,
      message: "Webhook recibido pero no procesado (no es mensaje entrante)",
    })
  } catch (error) {
    console.error("❌ Error procesando webhook:", error)

    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Endpoint de webhook de Kommo activo",
    timestamp: new Date().toISOString(),
    status: "healthy",
  })
}
