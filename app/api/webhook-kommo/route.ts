import { type NextRequest, NextResponse } from "next/server"
import type { KommoWebhookData, ProcessedMessage, SettingsDocument, StatusDocument } from "@/types/kommo"
import { processMessageWithAI } from "@/lib/ai-processor"
import { getCurrentLeadStatus } from "@/lib/kommo-api"
import { updateLeadStatusByName } from "@/lib/utils"
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
  logLeadStatusChange,
  logDuplicateMessageSkipped,
  logWebhookValidationPassed,
  logSpamDetected
} from "@/lib/logger"
import { createUser, createLead, createTask, updateTask, receiveMessage, createBotAction, getContactContext, findTokenVisit, sendConversionToMeta, saveSendMetaRecord, findLeadById, findContactById, createLeadFromKommoApi, createContactFromKommoApi, isMessageAlreadyProcessed, isConversionAlreadySent, getActiveRulesForAI, getSettingsById, getAllStatus, validateWebhookForProcessing, checkExistingMessageText } from "@/lib/mongodb-services"
import { getLeadInfo, getContactInfo } from "@/lib/kommo-api"
import type { KommoApiConfig } from "@/lib/kommo-api"
import { extractCodeFromMessage } from "@/lib/utils"
import { KOMMO_CONFIG } from "@/lib/kommo-config"
import { STATUS_MAPPING } from "@/lib/constants"

// Función helper para sincronizar lead y contacto desde API de Kommo
async function syncLeadAndContactFromKommoApi(leadId: string, contactId: string) {
  try {
    const config: KommoApiConfig = {
      subdomain: process.env.KOMMO_SUBDOMAIN || "",
    }

    if (!config.subdomain) {
      console.error("❌ KOMMO_SUBDOMAIN no configurado para sincronización")
      return
    }

    // Verificar si el lead existe localmente
    const existingLead = await findLeadById(leadId)
    let leadData = null

    if (!existingLead) {
      console.log(`🔄 Lead ${leadId} no existe localmente, obteniendo desde API de Kommo...`)
      leadData = await getLeadInfo(leadId, config)

      if (leadData) {
        // Verificar si el contacto existe localmente
        const existingContact = await findContactById(contactId)
        let contactData = null

        if (!existingContact) {
          console.log(`🔄 Contacto ${contactId} no existe localmente, obteniendo desde API de Kommo...`)
          contactData = await getContactInfo(contactId, config)

          if (contactData) {
            // Crear contacto
            await createContactFromKommoApi(contactData)
          }
        }

        // Crear lead
        await createLeadFromKommoApi(leadData, contactData)
      }
    } else {
      console.log(`✅ Lead ${leadId} ya existe localmente`)
    }

    // Verificar si el contacto existe (por si acaso)
    const existingContact = await findContactById(contactId)
    if (!existingContact) {
      console.log(`🔄 Contacto ${contactId} no existe localmente, obteniendo desde API de Kommo...`)
      const contactData = await getContactInfo(contactId, config)

      if (contactData) {
        await createContactFromKommoApi(contactData)
      }
    } else {
      console.log(`✅ Contacto ${contactId} ya existe localmente`)
    }

  } catch (error) {
    console.error("❌ Error al sincronizar lead y contacto desde API de Kommo:", error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook data
    const body = await request.text()
    logWebhookReceived(body)

    // VALIDACIÓN INICIAL DE PIPELINE: Solo procesar webhooks del pipeline 11862040
    console.log("🔍 Iniciando validación de pipeline...")

    // Parse form data para extraer pipeline_id y datos del webhook
    const formData = new URLSearchParams(body)
    const tempWebhookData: any = {}

    // Extraer datos básicos del form para validación de pipeline
    for (const [key, value] of formData.entries()) {
      // Extraer pipeline_id de leads (add, status, delete)
      if (key.includes("leads[") && key.includes("[pipeline_id]")) {
        if (!tempWebhookData.pipelineIds) {
          tempWebhookData.pipelineIds = []
        }
        tempWebhookData.pipelineIds.push(value)
      }
      // Extraer lead_id o entity_id de leads para consultar API si no hay pipeline_id
      if (key.includes("leads[") && (key.includes("[id]") || key.includes("[entity_id]"))) {
        if (!tempWebhookData.leadIds) {
          tempWebhookData.leadIds = []
        }
        tempWebhookData.leadIds.push(value)
      }
      // Extraer lead_id de messages (element_id o entity_id) para consultar API
      if (key.includes("message[") && (key.includes("[element_id]") || key.includes("[entity_id]"))) {
        if (!tempWebhookData.messageLeadIds) {
          tempWebhookData.messageLeadIds = []
        }
        tempWebhookData.messageLeadIds.push(value)
      }
    }

    // Intentar obtener pipeline_id del webhook
    let pipelineId: string | null = null

    if (tempWebhookData.pipelineIds && tempWebhookData.pipelineIds.length > 0) {
      pipelineId = tempWebhookData.pipelineIds[0] // Tomar el primer pipeline_id encontrado
      console.log(`✅ Pipeline ID encontrado en webhook: ${pipelineId}`)
    }

    // Si no hay pipeline_id en el webhook, intentar obtenerlo consultando la API con lead_id
    if (!pipelineId) {
      // Primero intentar con leadIds de leads, luego con messageLeadIds de messages
      const leadIdSource = tempWebhookData.leadIds && tempWebhookData.leadIds.length > 0
        ? tempWebhookData.leadIds[0]
        : tempWebhookData.messageLeadIds && tempWebhookData.messageLeadIds.length > 0
          ? tempWebhookData.messageLeadIds[0]
          : null

      if (leadIdSource) {
        console.log(`🔍 Pipeline ID no encontrado en webhook, consultando API para lead ${leadIdSource}...`)

        try {
          const config: KommoApiConfig = {
            subdomain: process.env.KOMMO_SUBDOMAIN || "",
          }

          if (!config.subdomain) {
            console.error("❌ KOMMO_SUBDOMAIN no configurado para validación de pipeline")
            return NextResponse.json({
              success: false,
              error: "KOMMO_SUBDOMAIN no configurado"
            }, { status: 500 })
          }

          const leadInfo = await getLeadInfo(leadIdSource, config)
          if (leadInfo && leadInfo.pipeline_id) {
            pipelineId = leadInfo.pipeline_id.toString()
            console.log(`✅ Pipeline ID obtenido de API para lead ${leadIdSource}: ${pipelineId}`)
          } else {
            console.log(`⚠️ No se pudo obtener pipeline_id del lead ${leadIdSource} desde API de Kommo`)
          }
        } catch (error) {
          console.error(`❌ Error al consultar pipeline_id del lead ${leadIdSource}:`, error)
          // Continuar sin cortar la ejecución por ahora
        }
      } else {
        console.log(`⚠️ No se encontraron lead IDs en el webhook para consultar pipeline`)
      }
    }

    // Validar que el pipeline sea el correcto (11862040)
    if (pipelineId && pipelineId !== KOMMO_CONFIG.pipelines[0].id) {
      console.log(`🚫 Webhook RECHAZADO: Pipeline ${pipelineId} no autorizado. Solo se procesan webhooks del pipeline ${KOMMO_CONFIG.pipelines[0].id}`)
      return NextResponse.json({
        success: false,
        message: `Webhook rechazado: Pipeline ${pipelineId} no autorizado. Solo se procesan webhooks del pipeline 11862040`,
        pipeline_id: pipelineId,
        required_pipeline: KOMMO_CONFIG.pipelines[0].id
      }, { status: 200 }) // 200 porque es un procesamiento válido pero rechazado
    }

    if (pipelineId === KOMMO_CONFIG.pipelines[0].id) {
      console.log(`✅ Validación de pipeline exitosa: Procesando webhook del pipeline ${pipelineId}`)
    } else {
      console.log(`⚠️ No se pudo validar pipeline (posiblemente webhook sin leads), continuando procesamiento...`)
    }

    // Continuar parseando form data (Kommo sends form-encoded data)
    const webhookData: Partial<KommoWebhookData> = {}

    // Parse the form data into our structure
    for (const [key, value] of formData.entries()) {
      if (key.includes("message[add][0]")) {
        if (!webhookData.message) {
          webhookData.message = { add: [{ id: "", chat_id: "", talk_id: "", contact_id: "", text: "", created_at: "", element_type: "", entity_type: "", element_id: "", entity_id: "", type: "incoming", author: { id: "", type: "", name: "" }, attachment: { type: "", link: "", file_name: "" } }] }
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

      if (key.includes("leads[add][0]")) {
        if (!webhookData.leads) {
          (webhookData as any).leads = { add: [{ id: "", name: "", status_id: "", responsible_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "" }] }
        }
        if (!(webhookData as any).leads.add) {
          (webhookData as any).leads.add = [{ id: "", name: "", status_id: "", responsible_user_id: "", created_user_id: "", date_create: "", pipeline_id: "", account_id: "", created_at: "" }]
        }

        const field = key.replace("leads[add][0][", "").replace("]", "")
        if ((webhookData as any).leads.add) {
          ;((webhookData as any).leads.add[0] as any)[field] = value
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

        // Procesar código para Meta si existe en el message_text
        const messageText = unsortedAdd.source_data?.data?.[0]?.text || ""
        if (messageText.trim() !== "") {
          const extractedCode = extractCodeFromMessage(messageText)
          if (extractedCode) {
            console.log(`🔍 Código detectado en unsorted add: ${extractedCode}`)

            try {
              // Buscar el token en la base de datos
              const tokenVisit = await findTokenVisit(extractedCode)

              if (tokenVisit) {
                console.log(`✅ Token encontrado para unsorted add:`, tokenVisit)

                // Verificar si ya se envió una conversión para este código y tipo de evento en los últimos 30 minutos
                const conversionAlreadySent = await isConversionAlreadySent(extractedCode, "ConversacionCRM1")
                if (conversionAlreadySent) {
                  console.log(`⚠️ Conversión ya enviada para código ${extractedCode} en los últimos 30 minutos - omitiendo envío duplicado`)
                  return NextResponse.json({
                    success: true,
                    processed: false,
                    message: `Conversión ya enviada para código ${extractedCode}`,
                    duplicate_conversion: true
                  })
                }

                // Enviar conversión a Meta API
                const metaAccessToken = process.env.META_ACCESS_TOKEN
                if (!metaAccessToken) {
                  console.error("❌ META_ACCESS_TOKEN no configurado")
                  return NextResponse.json({
                    success: false,
                    processed: false,
                    message: "META_ACCESS_TOKEN no configurado",
                  })
                }

                const conversionResult = await sendConversionToMeta({
                  ...tokenVisit.lead,
                  extractedCode: extractedCode,
                  eventName: process.env.NEXT_PUBLIC_META_EVENT_1
                }, metaAccessToken)

                // Verificar si la conversión se envió exitosamente (no fue duplicada)
                if (!conversionResult.success) {
                  if (conversionResult.error === "DUPLICATE_CONVERSION") {
                    console.log(`⚠️ Conversión duplicada detectada para unsorted add con código: ${extractedCode}`)
                    return NextResponse.json({
                      success: true,
                      processed: false,
                      message: `Conversión ya enviada anteriormente para código ${extractedCode}`,
                      duplicate_conversion: true
                    })
                  } else {
                    console.error(`❌ Error al enviar conversión para unsorted add con código ${extractedCode}:`, conversionResult.error)
                    return NextResponse.json({
                      success: false,
                      processed: false,
                      message: "Error al enviar conversión",
                      error: conversionResult.error
                    })
                  }
                }

                // Preparar datos para guardar en send_meta
                const conversionData = {
                  data: [
                    {
                      event_name: process.env.NEXT_PUBLIC_META_EVENT_1,
                      event_time: Math.floor(Date.now() / 1000),
                      action_source: "website",
                      event_source_url: tokenVisit.lead.eventSourceUrl || "https://kommo-ai-integration.vercel.app/",
                      user_data: {
                        client_ip_address: tokenVisit.lead.ip ? tokenVisit.lead.ip : undefined,
                        client_user_agent: tokenVisit.lead.userAgent ? tokenVisit.lead.userAgent : undefined,
                        fbp: tokenVisit.lead.fbp ? tokenVisit.lead.fbp : undefined,
                        fbc: tokenVisit.lead.fbc ? tokenVisit.lead.fbc : undefined,
                      }
                    }
                  ]
                }

                // Guardar registro en colección send_meta
                // Array con [0] = ConversacionCRM1
                const saveResult = await saveSendMetaRecord(
                  [conversionData],
                  {
                    id: unsortedAdd.source_data?.data?.[0]?.id || unsortedAdd.uid,
                    chatId: unsortedAdd.source_data?.origin?.chat_id || "",
                    talkId: "",
                    contactId: unsortedAdd.data?.contacts?.[0]?.id || "",
                    text: messageText,
                    createdAt: unsortedAdd.created_at,
                    elementType: "unsorted",
                    entityType: "add",
                    elementId: unsortedAdd.uid,
                    entityId: unsortedAdd.lead_id,
                    type: "incoming",
                    author: {
                      name: unsortedAdd.source_data?.client?.name || "Unknown",
                      id: unsortedAdd.source_data?.client?.id || ""
                    }
                  },
                  extractedCode,
                  [conversionResult]
                )

                if (saveResult.success) {
                  console.log(`💾 Registro guardado en send_meta para unsorted add con código: ${extractedCode}`)
                } else {
                  console.error(`❌ Error al guardar en send_meta para unsorted add con código ${extractedCode}:`, saveResult.error)
                }

                if (conversionResult.success) {
                  console.log(`🎉 Conversión enviada exitosamente para unsorted add con código: ${extractedCode}`)

                  // Sincronizar lead y contacto desde API de Kommo si no existen localmente
                  const leadId = unsortedAdd.lead_id
                  const contactId = unsortedAdd.data?.contacts?.[0]?.id
                  if (leadId && contactId) {
                    await syncLeadAndContactFromKommoApi(leadId, contactId)
                  }
                } else {
                  console.error(`❌ Error al enviar conversión para unsorted add con código ${extractedCode}:`, conversionResult.error)
                }
              } else {
                console.log(`⚠️ Código no encontrado en base de datos para unsorted add: ${extractedCode}`)
              }
            } catch (error) {
              console.error(`❌ Error al procesar código ${extractedCode} en unsorted add:`, error)
            }
          }
        }

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

      // Verificar si el status cambió a "Cargo" (91366615)
      if (leadStatusChange.status_id === "91366615") {
        console.log(`🎯 Lead cambió a status "Cargo" (91366615): ${leadStatusChange.id}`)

        try {
          // Consultar el lead en la base de datos
          const leadData = await findLeadById(leadStatusChange.id)

          if (leadData && leadData.meta_data) {
            console.log(`✅ Lead encontrado con meta_data:`, leadData._id)

            // Extraer datos del meta_data para la conversión
            const metaData = leadData.meta_data
            const originalUserData = metaData.conversionData[0].data[0].user_data

            // Crear nueva conversión con event_name "CargoCRM1"
            const cargoConversionData = {
              data: [
                {
                  event_name: process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1", // Evento específico para status "Cargo"
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
            } else {
              const conversionResult = await sendConversionToMeta(
                {
                  ip: originalUserData.client_ip_address,
                  userAgent: originalUserData.client_user_agent,
                  fbp: originalUserData.fbp,
                  fbc: originalUserData.fbc,
                  eventSourceUrl: metaData.conversionData[0].data[0].event_source_url,
                  extractedCode: metaData.extractedCode,
                  eventName: process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1" // Especificar que es CargoCRM1
                },
                metaAccessToken
              )

              // Verificar si la conversión se envió exitosamente (no fue duplicada)
              if (!conversionResult.success) {
                if (conversionResult.error === "DUPLICATE_CONVERSION") {
                  console.log(`⚠️ Conversión duplicada detectada para CargoCRM1 con código: ${metaData.extractedCode}`)
                  // No retornar, continuar con el procesamiento
                } else {
                  console.error(`❌ Error al enviar conversión CargoCRM1 para código ${metaData.extractedCode}:`, conversionResult.error)
                }
              }

              // Preparar datos para guardar en send_meta
              const messageData = {
                id: `status_change_${leadStatusChange.id}_${Date.now()}`,
                chatId: metaData.messageData.chatId,
                talkId: metaData.messageData.talkId,
                contactId: leadData.contactId,
                text: `Status changed to Cargo (${leadStatusChange.status_id})`,
                createdAt: leadStatusChange.last_modified || new Date().toISOString(),
                elementType: "lead",
                entityType: "status_change",
                elementId: leadStatusChange.id,
                entityId: leadStatusChange.id,
                type: "status_change",
                author: {
                  name: "System",
                  id: leadStatusChange.modified_user_id || "system"
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
                console.log(`💾 Registro guardado en send_meta para status change Cargo: ${leadStatusChange.id}`)
              } else {
                console.error(`❌ Error al guardar en send_meta para status change ${leadStatusChange.id}:`, saveResult.error)
              }

              if (conversionResult.success) {
                console.log(`🎉 Conversión "CargoCRM1" enviada exitosamente para lead: ${leadStatusChange.id}`)
              } else {
                console.error(`❌ Error al enviar conversión "CargoCRM1" para lead ${leadStatusChange.id}:`, conversionResult.error)
              }
            }
          } else {
            console.log(`⚠️ Lead no encontrado o sin meta_data: ${leadStatusChange.id}`)
          }
        } catch (error) {
          console.error(`❌ Error al procesar status change para lead ${leadStatusChange.id}:`, error)
        }
      }

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

    // Process lead add events (when a lead is created with specific status)
    if ((webhookData as any).leads?.add?.[0]) {
      const leadAdd = (webhookData as any).leads.add[0]

      // Log the lead creation
      console.log(`📝 Lead creado con ID: ${leadAdd.id}, Status: ${leadAdd.status_id}`)

      // Verificar si el lead se creó con status "Cargo" (91366615)
      if (leadAdd.status_id === "91366615") {
        console.log(`🎯 Lead creado directamente con status "Cargo" (91366615): ${leadAdd.id}`)

        try {
          // Buscar si este lead ya existe con meta_data (puede haber sido creado por un mensaje anterior)
          const existingLead = await findLeadById(leadAdd.id)

          if (existingLead && existingLead.meta_data) {
            console.log(`✅ Lead encontrado con meta_data existente:`, existingLead._id)

            // Extraer datos del meta_data para la conversión
            const metaData = existingLead.meta_data
            const originalUserData = metaData.conversionData[0].data[0].user_data

            // Crear nueva conversión con event_name "${process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1"}"   
            const cargoConversionData = {
              data: [
                {
                  event_name: process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1", // Evento específico para status "Cargo"
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
            } else {
              const conversionResult = await sendConversionToMeta(
                {
                  ip: originalUserData.client_ip_address,
                  userAgent: originalUserData.client_userAgent,
                  fbp: originalUserData.fbp,
                  fbc: originalUserData.fbc,
                  eventSourceUrl: metaData.conversionData[0].data[0].event_source_url
                },
                metaAccessToken
              )

              // Preparar datos para guardar en send_meta
              const messageData = {
                id: `lead_add_cargo_${leadAdd.id}_${Date.now()}`,
                chatId: metaData.messageData.chatId,
                talkId: metaData.messageData.talkId,
                contactId: existingLead.contactId,
                text: `Lead created with Cargo status (${leadAdd.status_id})`,
                createdAt: leadAdd.created_at || new Date().toISOString(),
                elementType: "lead",
                entityType: "add",
                elementId: leadAdd.id,
                entityId: leadAdd.id,
                type: "lead_add",
                author: {
                  name: "System",
                  id: leadAdd.created_user_id || "system"
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
                console.log(`💾 Registro guardado en send_meta para lead add "${process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1"}": ${leadAdd.id}`)
              } else {
                console.error(`❌ Error al guardar en send_meta para lead add ${leadAdd.id}:`, saveResult.error)
              }

              if (conversionResult.success) {
                console.log(`🎉 Conversión "${process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1"}" enviada exitosamente para lead add: ${leadAdd.id}`)
              } else {
                console.error(`❌ Error al enviar conversión "${process.env.NEXT_PUBLIC_META_EVENT_2 || "CargoCRM1"}" para lead add ${leadAdd.id}:`, conversionResult.error)
              }
            }
          } else {
            console.log(`⚠️ Lead no encontrado con meta_data para ID: ${leadAdd.id} - Puede ser un lead creado sin mensaje previo`)
          }
        } catch (error) {
          console.error(`❌ Error al procesar lead add para lead ${leadAdd.id}:`, error)
        }
      }

      return NextResponse.json({
        success: true,
        processed: true,
        type: "lead_add",
        lead: {
          id: leadAdd.id,
          name: leadAdd.name,
          status_id: leadAdd.status_id,
          pipeline_id: leadAdd.pipeline_id,
          created_by: leadAdd.created_user_id,
          created_at: leadAdd.created_at
        },
        message: "Lead creado correctamente",
      })
    }

    // Process only incoming messages
    if (webhookData.message?.add?.[0]?.type === "incoming") {
      const message = webhookData.message.add[0]

      // Save message to database first and process with AI only if save succeeds
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
          author: message.author,
          attachment: message.attachment
        })

        // Solo procesar con IA si el mensaje se guardó correctamente en la DB

        // VALIDAR QUE EL MENSAJE NO SEA DUPLICADO POR TEXTO ANTES DE PROCESAR CON IA
        const alreadyProcessedByMessageText = await checkExistingMessageText(message.text, message.entity_id, message.created_at);

        if (alreadyProcessedByMessageText) {
          console.log(`⚠️ Mensaje ya procesado anteriormente (message.text: "${message.text}") - saltando todo el procesamiento`);
          return NextResponse.json({
            success: true,
            message: "Mensaje ya procesado anteriormente por texto - no reprocesado",
            messageText: message.text,
            skipped: true,
            duplicate_reason: "message_text_already_processed"
          });
        }

        // Validar si el mensaje contiene un código
        const extractedCode = extractCodeFromMessage(message.text)
        if (extractedCode) {

          try {
            // Buscar el token en la base de datos
            const tokenVisit = await findTokenVisit(extractedCode)

            if (tokenVisit) {
              console.log(`✅ Token encontrado:`, tokenVisit)

              // Verificar si ya se envió una conversión para este código y tipo de evento en los últimos 30 minutos
              const conversionAlreadySent = await isConversionAlreadySent(extractedCode, process.env.NEXT_PUBLIC_META_EVENT_1 || "ConversacionCRM1")
              if (conversionAlreadySent) {
                console.log(`⚠️ Conversión ya enviada para código ${extractedCode} en los últimos 30 minutos - omitiendo envío duplicado`)
                // Continuar con el procesamiento del mensaje (no retornar aquí)
              } else {
                // Enviar conversión a Meta API
              const metaAccessToken = process.env.META_ACCESS_TOKEN
              if (!metaAccessToken) {
                console.error("❌ META_ACCESS_TOKEN no configurado")
                return NextResponse.json({
                  success: false,
                  processed: false,
                  message: "META_ACCESS_TOKEN no configurado",
                })
              }
              const conversionResult = await sendConversionToMeta({
                ...tokenVisit.lead,
                extractedCode: extractedCode,
                eventName: process.env.NEXT_PUBLIC_META_EVENT_1
              }, metaAccessToken)

              // Preparar datos para guardar en send_meta
              const conversionData = {
                data: [
                  {
                    event_name: process.env.NEXT_PUBLIC_META_EVENT_1,
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: "website",
                    event_source_url: tokenVisit.lead.eventSourceUrl || "https://kommo-ai-integration.vercel.app",
                    user_data: {
                      client_ip_address: tokenVisit.lead.ip ? tokenVisit.lead.ip : undefined,
                      client_user_agent: tokenVisit.lead.userAgent ? tokenVisit.lead.userAgent : undefined,
                      fbp: tokenVisit.lead.fbp ? tokenVisit.lead.fbp : undefined,
                      fbc: tokenVisit.lead.fbc ? tokenVisit.lead.fbc : undefined,
                    }
                  }
                ]
              };

              // Guardar registro en colección send_meta
              // Array con [0] = ConversacionCRM1
              const saveResult = await saveSendMetaRecord(
                [conversionData],
                message,
                extractedCode,
                [conversionResult]
              );

              if (saveResult.success) {
                console.log(`💾 Registro guardado en send_meta para código: ${extractedCode}`)
              } else {
                console.error(`❌ Error al guardar en send_meta para código ${extractedCode}:`, saveResult.error)
              }

              if (conversionResult.success) {
                console.log(`🎉 Conversión enviada exitosamente para código: ${extractedCode}`)

                // Sincronizar lead y contacto desde API de Kommo si no existen localmente
                await syncLeadAndContactFromKommoApi(message.entity_id, message.contact_id)
              } else {
                console.error(`❌ Error al enviar conversión para código ${extractedCode}:`, conversionResult.error)
              }
              }
            } else {
              console.log(`⚠️ Código no encontrado en base de datos: ${extractedCode}`)
            }
          } catch (error) {
            console.error(`❌ Error al procesar código ${extractedCode}:`, error)
          }
        }

        if (message.talk_id && message.entity_id) {
          // Verificar si el mensaje ya fue procesado por la IA para evitar reprocesamiento
          const alreadyProcessed = await isMessageAlreadyProcessed(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text
          )

          if (alreadyProcessed) {
            logMessageSkipped(`Mensaje ya procesado anteriormente - ignorando reprocesamiento: ${message.id}`)
            return NextResponse.json({
              success: true,
              processed: false,
              message: "Mensaje ya procesado anteriormente - no reprocesado",
              duplicate: true
            })
          }

          logMessageProcessing(message.text, message.author?.name || "Cliente", message.talk_id, message.entity_id, message.attachment)

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

          // Obtener contexto histórico del contacto (últimas 24 horas)
          let contactContext
          try {
            contactContext = await getContactContext(message.contact_id)
          } catch (contextError) {
            logWebhookError(contextError, "obteniendo contexto histórico del contacto")
            // Continuar sin contexto si hay error
          }

          let simplifiedRules: Array<{ priority: number; rule: string }> = []
          try {
            simplifiedRules = await getActiveRulesForAI()
            console.log("📋 Reglas normalizadas para AI:", simplifiedRules)

          } catch (rulesError) {
            logWebhookError(rulesError, "obteniendo reglas generales")
            // Continuar sin reglas si hay error (array vacío)
          }

          let settings: SettingsDocument | null = null
          try {
            settings = await getSettingsById(KOMMO_CONFIG.pipelines[0].settings.id || "")
          } catch (settingsError) {
            logWebhookError(settingsError, "obteniendo settings")
          }

          let statuses: StatusDocument[] | null = null
          try {
            statuses = await getAllStatus()
          } catch (statusesError) {
            logWebhookError(statusesError, "obteniendo statuses")
          }

          // VALIDAR QUE EL MENSAJE NO SEA DUPLICADO ANTES DE PROCESAR CON IA
          const validationResult = await validateWebhookForProcessing(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text,
            message.type,
            message.element_type
          )

          if (!validationResult.shouldProcess) {
            // Loggear mensaje duplicado y saltar procesamiento
            logDuplicateMessageSkipped(
              message.talk_id,
              message.entity_id,
              message.contact_id,
              message.text,
              validationResult.reason || "Sin razón especificada",
              validationResult.duplicateInfo?.type || 'message',
              validationResult.duplicateInfo?.lastProcessedAt
            )

            // Loggear spam si fue detectado
            if (validationResult.duplicateInfo?.type === 'event') {
              logSpamDetected(message.contact_id, 2, 5) // Asumiendo 2 mensajes en 5 minutos
            }

            // Continuar con el flujo pero sin procesar IA
            logMessageSkipped(`Mensaje duplicado saltado: ${validationResult.reason}`)
            return NextResponse.json({
              success: true,
              message: "Mensaje duplicado detectado y saltado",
              duplicate: true,
              reason: validationResult.reason
            })
          }

          // Loggear que la validación pasó
          logWebhookValidationPassed(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text
          )

          // Process with AI usando el status efectivo, contexto histórico y reglas simplificadas
          const aiDecision = await processMessageWithAI(message.text, effectiveStatus, message.talk_id, contactContext, simplifiedRules, settings, statuses, message.attachment)

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

          if (aiDecision.shouldChange) {
            logStatusChange(aiDecision.currentStatus, aiDecision.newStatus, aiDecision.reasoning, message.talk_id, message.entity_id)

            try {
              const updateSuccess = await updateLeadStatusByName(
                message.entity_id,
                aiDecision.newStatus as keyof typeof STATUS_MAPPING,
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
      } catch (error) {
        logWebhookError(error, "guardando mensaje en base de datos")
        // Si falla el guardado en DB, no se procesa con IA
        return NextResponse.json({
          success: false,
          processed: false,
          message: "Error al guardar mensaje en base de datos - no se procesó con IA",
          error: error instanceof Error ? error.message : "Error desconocido",
        }, { status: 500 })
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
