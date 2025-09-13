import { type NextRequest, NextResponse } from "next/server"
import type { KommoWebhookData, ProcessedMessage } from "@/types/kommo"
import { processMessageWithAI } from "@/lib/ai-processor"
import { updateLeadStatusByName, getCurrentLeadStatus, type KommoApiConfig } from "@/lib/kommo-api"
import {
  logWebhookReceived,
  logWebhookParsed,
  logMessageProcessing,
  logLeadStatusQuery,
  logLeadStatusRetrieved,
  logAiDecision,
  logStatusChange,
  logLeadUpdateSuccess,
  logLeadUpdateError,
  logConfigWarning,
  logMessageSkipped,
  logWebhookError,
  logLeadStatusChange
} from "@/lib/logger"
import { createUser, createLead, createTask, updateTask, receiveMessage, createBotAction } from "@/lib/mongodb-services"

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook data
    const body = await request.text()
    logWebhookReceived(body)
      // Console.log del body completo

    

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
        if (webhookData.talk.add) {
          ;(webhookData.talk.add[0] as any)[field] = value
        }
      }

      if (key.includes("talk[update][0]")) {
        if (!webhookData.talk) {
          webhookData.talk = { update: [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }] }
        }
        if (!webhookData.talk.update) {
          webhookData.talk.update = [{ talk_id: "", created_at: "", updated_at: "", rate: "", contact_id: "", chat_id: "", entity_id: "", entity_type: "", is_in_work: "", is_read: "", origin: "" }]
        }

        const field = key.replace("talk[update][0][", "").replace("]", "")
        ;(webhookData.talk.update[0] as any)[field] = value
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

      if (key.includes("leads[status][0]")) {
        if (!webhookData.leads) {
          webhookData.leads = { status: [{ id: "", name: "", status_id: "", old_status_id: "", responsible_user_id: "", last_modified: "", modified_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "", updated_at: "" }] }
        }

        const field = key.replace("leads[status][0][", "").replace("]", "")
        if (webhookData.leads.status) {
          ;(webhookData.leads.status[0] as any)[field] = value
        }
      }

      if (key.includes("leads[delete][0]")) {
        if (!webhookData.leads) {
          webhookData.leads = { delete: [{ id: "", status_id: "", pipeline_id: "" }] }
        }
        if (!webhookData.leads.delete) {
          webhookData.leads.delete = [{ id: "", status_id: "", pipeline_id: "" }]
        }

        const field = key.replace("leads[delete][0][", "").replace("]", "")
        ;(webhookData.leads.delete[0] as any)[field] = value
      }

      if (key.includes("unsorted[add][0]")) {
        if (!webhookData.unsorted) {
          webhookData.unsorted = {
            add: [{
              uid: "",
              source: "",
              source_uid: "",
              category: "",
              source_data: {
                from: "",
                name: "",
                to: "",
                date: "",
                service: "",
                site: "",
                client: { name: "", id: "" },
                origin: { provider: "", chat_id: "" },
                data: [{ id: "", manager: "", date: "", text: "" }],
                source_uid: "",
                source: "",
                source_name: ""
              },
              date_create: "",
              data: { contacts: [{ id: "" }] },
              pipeline_id: "",
              account_id: "",
              source_id: "",
              lead_id: "",
              created_at: ""
            }]
          }
        }

        const field = key.replace("unsorted[add][0][", "").replace("]", "")

        if (webhookData.unsorted.add) {
          if (field.includes("source_data[")) {
            if (!webhookData.unsorted.add[0].source_data) {
              webhookData.unsorted.add[0].source_data = {
                from: "",
                name: "",
                to: "",
                date: "",
                service: "",
                site: "",
                client: { name: "", id: "" },
                origin: { provider: "", chat_id: "" },
                data: [{ id: "", manager: "", date: "", text: "" }],
                source_uid: "",
                source: "",
                source_name: ""
              }
            }

            const sourceField = field.replace("source_data[", "").replace("]", "")
            if (sourceField.includes("client[")) {
              const clientField = sourceField.replace("client[", "").replace("]", "")
              if (!webhookData.unsorted.add[0].source_data.client) {
                webhookData.unsorted.add[0].source_data.client = { name: "", id: "" }
              }
              ;(webhookData.unsorted.add[0].source_data.client as any)[clientField] = value
            } else if (sourceField.includes("origin[")) {
              const originField = sourceField.replace("origin[", "").replace("]", "")
              if (!webhookData.unsorted.add[0].source_data.origin) {
                webhookData.unsorted.add[0].source_data.origin = { provider: "", chat_id: "" }
              }
              ;(webhookData.unsorted.add[0].source_data.origin as any)[originField] = value
            } else if (sourceField.includes("data[0][")) {
              const dataField = sourceField.replace("data[0][", "").replace("]", "")
              if (!webhookData.unsorted.add[0].source_data.data) {
                webhookData.unsorted.add[0].source_data.data = [{ id: "", manager: "", date: "", text: "" }]
              }
              ;(webhookData.unsorted.add[0].source_data.data[0] as any)[dataField] = value
            } else {
              ;(webhookData.unsorted.add[0].source_data as any)[sourceField] = value
            }
          } else if (field.includes("data[contacts][0][")) {
            const contactField = field.replace("data[contacts][0][", "").replace("]", "")
            if (!webhookData.unsorted.add[0].data.contacts) {
              webhookData.unsorted.add[0].data.contacts = [{ id: "" }]
            }
            ;(webhookData.unsorted.add[0].data.contacts[0] as any)[contactField] = value
          } else {
            ;(webhookData.unsorted.add[0] as any)[field] = value
          }
        }
      }

      if (key.includes("unsorted[delete][0]")) {
        if (!webhookData.unsorted) {
          webhookData.unsorted = {
            delete: [{
              action: "",
              decline_result: { leads: [] },
              uid: "",
              category: "",
              created_at: "",
              modified_user_id: ""
            }]
          }
        }
        if (!webhookData.unsorted.delete) {
          webhookData.unsorted.delete = [{
            action: "",
            decline_result: { leads: [] },
            uid: "",
            category: "",
            created_at: "",
            modified_user_id: ""
          }]
        }

        const field = key.replace("unsorted[delete][0][", "").replace("]", "")

        if (field.includes("decline_result[leads]")) {
          const leadIndex = field.match(/decline_result\[leads\]\[(\d+)\]/)
          if (leadIndex && leadIndex[1]) {
            const index = parseInt(leadIndex[1])
            if (!webhookData.unsorted.delete[0].decline_result.leads) {
              webhookData.unsorted.delete[0].decline_result.leads = []
            }
            if (webhookData.unsorted.delete[0].decline_result.leads.length <= index) {
              webhookData.unsorted.delete[0].decline_result.leads.length = index + 1
            }
            webhookData.unsorted.delete[0].decline_result.leads[index] = value
          }
        } else {
          ;(webhookData.unsorted.delete[0] as any)[field] = value
        }
      }
    }

    // Mostrar datos parseados de manera legible
    logWebhookParsed(
      webhookData.account,
      webhookData.message?.add?.[0],
      webhookData.talk?.add?.[0],
      webhookData.leads,
      webhookData.talk?.update?.[0],
      webhookData.unsorted?.add?.[0],
      webhookData.leads?.delete?.[0],
      webhookData.unsorted?.delete?.[0]
    )

    // Process unsorted add (create lead and user)
    if (webhookData.unsorted?.add?.[0]) {
      const unsortedAdd = webhookData.unsorted.add[0]

      try {
        // Create user
        await createUser({
          sourceUid: unsortedAdd.source_uid,
          client: {
            name: unsortedAdd.source_data?.client?.name || "Unknown",
            id: unsortedAdd.source_data?.client?.id || ""
          },
          createdAt: unsortedAdd.created_at,
          contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
          source: unsortedAdd.source,
          sourceName: unsortedAdd.source_data?.source_name || "",
          messageText: unsortedAdd.source_data?.data?.[0]?.text || ""
        })

        // Create lead
        await createLead({
          uid: unsortedAdd.uid,
          source: unsortedAdd.source,
          sourceUid: unsortedAdd.source_uid,
          category: unsortedAdd.category,
          leadId: unsortedAdd.lead_id,
          contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
          pipelineId: unsortedAdd.pipeline_id,
          createdAt: unsortedAdd.created_at,
          client: {
            name: unsortedAdd.source_data?.client?.name || "Unknown",
            id: unsortedAdd.source_data?.client?.id || ""
          },
          messageText: unsortedAdd.source_data?.data?.[0]?.text || "",
          sourceName: unsortedAdd.source_data?.source_name || ""
        })

        return NextResponse.json({
          success: true,
          processed: true,
          type: "unsorted_add",
          lead_id: unsortedAdd.lead_id,
          contact_id: unsortedAdd.data?.contacts?.[0]?.id,
          message: "Lead y usuario creados correctamente",
        })
      } catch (error) {
        logWebhookError(error, "procesando unsorted add")
        return NextResponse.json({
          success: false,
          processed: false,
          error: "Error creando lead/usuario",
          details: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
      }
    }

    // Process talk add (create task)
    if (webhookData.talk?.add?.[0]) {
      const talkAdd = webhookData.talk.add[0]

      try {
        await createTask({
          talkId: talkAdd.talk_id,
          contactId: talkAdd.contact_id,
          chatId: talkAdd.chat_id,
          entityId: talkAdd.entity_id,
          entityType: talkAdd.entity_type,
          origin: talkAdd.origin,
          isInWork: talkAdd.is_in_work,
          isRead: talkAdd.is_read,
          createdAt: talkAdd.created_at
        })

        return NextResponse.json({
          success: true,
          processed: true,
          type: "talk_add",
          talk_id: talkAdd.talk_id,
          message: "Conversación creada correctamente",
        })
      } catch (error) {
        logWebhookError(error, "procesando talk add")
        return NextResponse.json({
          success: false,
          processed: false,
          error: "Error creando conversación",
          details: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
      }
    }

    // Process talk update (update task)
    if (webhookData.talk?.update?.[0]) {
      const talkUpdate = webhookData.talk.update[0]

      try {
        await updateTask({
          talkId: talkUpdate.talk_id,
          contactId: talkUpdate.contact_id,
          chatId: talkUpdate.chat_id,
          entityId: talkUpdate.entity_id,
          entityType: talkUpdate.entity_type,
          origin: talkUpdate.origin,
          isInWork: talkUpdate.is_in_work,
          isRead: talkUpdate.is_read,
          updatedAt: talkUpdate.updated_at
        })

        return NextResponse.json({
          success: true,
          processed: true,
          type: "talk_update",
          talk_id: talkUpdate.talk_id,
          message: "Conversación actualizada correctamente",
        })
      } catch (error) {
        logWebhookError(error, "procesando talk update")
        return NextResponse.json({
          success: false,
          processed: false,
          error: "Error actualizando conversación",
          details: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
      }
    }

    // Process lead status changes
    if (webhookData.leads?.status?.[0]) {
      const leadStatusChange = webhookData.leads.status[0]

      // Log the manual status change
      logLeadStatusChange(
        leadStatusChange.id,
        leadStatusChange.old_status_id,
        leadStatusChange.status_id,
        leadStatusChange.modified_user_id
      )

      return NextResponse.json({
        success: true,
        processed: true,
        type: "lead_status_change",
        lead: {
          id: leadStatusChange.id,
          name: leadStatusChange.name,
          old_status_id: leadStatusChange.old_status_id,
          new_status_id: leadStatusChange.status_id,
          modified_by: leadStatusChange.modified_user_id,
          last_modified: leadStatusChange.last_modified
        },
        message: "Cambio de estado del lead registrado correctamente",
      })
    }

    // Process only incoming messages
    if (webhookData.message?.add?.[0]?.type === "incoming") {
      const message = webhookData.message.add[0]

      // Save message to database first
      try {
        await receiveMessage({
          id: message.id,
          chatId: message.chat_id,
          talkId: message.talk_id,
          contactId: message.contact_id,
          text: message.text,
          createdAt: message.created_at,
          elementType: message.element_type,
          entityType: message.entity_type,
          elementId: message.element_id,
          entityId: message.entity_id,
          type: message.type as "incoming" | "outgoing",
          author: message.author
        })
      } catch (error) {
        logWebhookError(error, "guardando mensaje en base de datos")
        // Continue processing even if database save fails
      }

      // Validar que el mensaje tenga texto antes de procesar
      if (!message.text || message.text.trim() === "") {
        logMessageSkipped("Mensaje sin texto - ignorando procesamiento")
        return NextResponse.json({
          success: true,
          processed: false,
          message: "Mensaje sin texto - no procesado",
        })
      }

      if (message.talk_id && message.entity_id) {
        logMessageProcessing(message.text, message.author?.name || "Cliente", message.talk_id, message.entity_id)

        // Obtener la configuración de Kommo
        const config: KommoApiConfig = {
          subdomain: process.env.KOMMO_SUBDOMAIN || "",
        }

        if (!config.subdomain) {
          logConfigWarning("Configuración de Kommo incompleta - no se puede procesar el lead")
          return NextResponse.json({
            success: false,
            processed: false,
            message: "Configuración de Kommo incompleta",
          })
        }

        // Obtener el status actual del lead desde Kommo
        logLeadStatusQuery(message.entity_id)
        const currentStatus = await getCurrentLeadStatus(message.entity_id, config)

        // Usar 'sin-status' si no se puede obtener el status actual
        const effectiveStatus = currentStatus || 'sin-status'

        if (!currentStatus) {
          logConfigWarning(`No se pudo obtener el status actual del lead ${message.entity_id}, usando 'sin-status'`)
        } else {
          logLeadStatusRetrieved(message.entity_id, currentStatus, "")
        }

        // Process with AI usando el status efectivo (real o 'sin-status')
        const aiDecision = await processMessageWithAI(message.text, effectiveStatus, message.talk_id)

        const processedMessage: ProcessedMessage = {
          talkId: message.talk_id,
          contactId: message.contact_id,
          entityId: message.entity_id,
          messageText: message.text,
          authorName: message.author?.name || "Cliente",
          timestamp: new Date(Number.parseInt(message.created_at) * 1000).toISOString(),
          aiDecision,
        }

        logAiDecision(aiDecision, message.talk_id, message.entity_id)

        // Here you would typically:
        // 1. Save the processed message to your database
        // 2. If aiDecision.shouldChange is true, update the lead status in Kommo
        // 3. Log the activity for monitoring

        if (aiDecision.shouldChange) {
          logStatusChange(aiDecision.currentStatus, aiDecision.newStatus, aiDecision.reasoning, message.talk_id, message.entity_id)

          try {
            const updateSuccess = await updateLeadStatusByName(
              message.entity_id,
              aiDecision.newStatus as keyof typeof import("@/lib/kommo-api").STATUS_MAPPING,
              config
            )

            if (updateSuccess) {
              logLeadUpdateSuccess(message.entity_id, aiDecision.newStatus)
            } else {
              logLeadUpdateError(message.entity_id, aiDecision.newStatus)
            }

            // Registrar la acción del bot en la base de datos
            try {
              await createBotAction({
                talkId: message.talk_id,
                entityId: message.entity_id,
                contactId: message.contact_id,
                messageText: message.text,
                messageCreatedAt: message.created_at,
                aiDecision: {
                  currentStatus: aiDecision.currentStatus,
                  newStatus: aiDecision.newStatus,
                  shouldChange: aiDecision.shouldChange,
                  reasoning: aiDecision.reasoning,
                  confidence: aiDecision.confidence,
                },
                statusUpdateResult: {
                  success: updateSuccess,
                },
              })
            } catch (botActionError) {
              logWebhookError(botActionError, "registrando acción del bot en base de datos")
              // No lanzamos error aquí para no cortar el flujo principal
            }
          } catch (updateError) {
            logLeadUpdateError(message.entity_id, aiDecision.newStatus, updateError)

            // Registrar la acción del bot con error en la actualización
            try {
              await createBotAction({
                talkId: message.talk_id,
                entityId: message.entity_id,
                contactId: message.contact_id,
                messageText: message.text,
                messageCreatedAt: message.created_at,
                aiDecision: {
                  currentStatus: aiDecision.currentStatus,
                  newStatus: aiDecision.newStatus,
                  shouldChange: aiDecision.shouldChange,
                  reasoning: aiDecision.reasoning,
                  confidence: aiDecision.confidence,
                },
                statusUpdateResult: {
                  success: false,
                  error: updateError instanceof Error ? updateError.message : "Error desconocido",
                },
              })
            } catch (botActionError) {
              logWebhookError(botActionError, "registrando acción del bot con error en base de datos")
              // No lanzamos error aquí para no cortar el flujo principal
            }
          }
        } else {
          // Registrar la acción del bot cuando no se cambia el status
          try {
            await createBotAction({
              talkId: message.talk_id,
              entityId: message.entity_id,
              contactId: message.contact_id,
              messageText: message.text,
              messageCreatedAt: message.created_at,
              aiDecision: {
                currentStatus: aiDecision.currentStatus,
                newStatus: aiDecision.newStatus,
                shouldChange: aiDecision.shouldChange,
                reasoning: aiDecision.reasoning,
                confidence: aiDecision.confidence,
              },
              statusUpdateResult: {
                success: true, // No se intentó actualizar, así que es exitoso por defecto
              },
            })
          } catch (botActionError) {
            logWebhookError(botActionError, "registrando acción del bot sin cambio en base de datos")
            // No lanzamos error aquí para no cortar el flujo principal
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
    logWebhookError(error)

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
