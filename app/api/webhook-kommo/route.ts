import { type NextRequest, NextResponse } from "next/server";
import type {
  AIDecision,
  SettingsDocument,
  StatusDocument,
} from "@/types/kommo";
import { getCurrentLeadStatus } from "@/lib/kommo-api";
import syncLeadAndContactFromKommoApi, {
  getPipelineIdFromLeadId,
  updateLeadStatusByName,
} from "@/lib/utils";
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
  logDuplicateMessageSkipped,
  logWebhookValidationPassed,
  logSpamDetected,
  logger,
} from "@/lib/logger";
import {
  createUser,
  createLead,
  createTask,
  updateTask,
  receiveMessage,
  createBotAction,
  getContactContext,
  findTokenVisit,
  sendConversionToMeta,
  saveSendMetaRecord,
  findLeadById,
  findContactById,
  createLeadFromKommoApi,
  createContactFromKommoApi,
  isMessageAlreadyProcessed,
  isConversionAlreadySent,
  getActiveRulesForAI,
  getSettingsById,
  getAllStatus,
  validateWebhookForProcessing,
  checkExistingMessageText,
  KommoDatabaseService,
  createPaymentRequest,
} from "@/lib/mongodb-services";
import { getLeadInfo, getContactInfo } from "@/lib/kommo-api";
import type { KommoApiConfig } from "@/lib/kommo-api";
import { extractCodeFromMessage } from "@/lib/utils";
import {
  parseWebhookFormData,
  extractWebhookMetadata,
} from "@/lib/webhook-parser";
import { KOMMO_CONFIG, META_CONFIG } from "@/lib/kommo-config";
import { STATUS_MAPPING } from "@/lib/constants";
import {
  adapterConversionData,
  adapterUnsortedAddToCreateLead,
  adapterUnsortedAddToCreateUser,
} from "@/lib/adapters";
import { logConversionError } from "@/lib/errors/conversion";
import { logPipelineError } from "@/lib/errors/pipeline";
import { processMessageWithAI } from "@/service/agents";

export async function POST(request: NextRequest) {
  try {
    // Parse the webhook data
    const body = await request.text();
    logWebhookReceived(body);

    // Simple parse fast
    const formData = new URLSearchParams(body);
    const tempWebhookData = extractWebhookMetadata(formData);

    // Intentar obtener pipeline_id del webhook
    let pipelineId: string | null = null;
    let aiDecision: AIDecision = {
      currentStatus: "sin-status",
      newStatus: "sin-status",
      shouldChange: false,
      reasoning: "",
      confidence: 0,
      attachment: null,
    };

    // Validar si el pipeline_id está en el webhook
    if (tempWebhookData.pipelineIds && tempWebhookData.pipelineIds.length > 0) {
      pipelineId = tempWebhookData.pipelineIds[0]; // Tomar el primer pipeline_id encontrado
      console.log(`✅ Pipeline ID encontrado en webhook: ${pipelineId}`);
    }

    // Si no hay pipeline_id en el webhook, intentar obtenerlo consultando la API con lead_id
    if (!pipelineId) {
      const getPipelineIdFromLeadIdResult = await getPipelineIdFromLeadId(
        tempWebhookData
      );
      if (getPipelineIdFromLeadIdResult) {
        pipelineId = getPipelineIdFromLeadIdResult;
      }
    }

    // Validar si el pipeline_id es el correcto
    if (pipelineId && pipelineId !== KOMMO_CONFIG.pipelines[0].id) {
      logPipelineError(pipelineId);
    }

    //  Parseamos los datos del webhook en objeto
    const webhookData = parseWebhookFormData(formData);

    // loggear datos parseados de manera legible segun el tipo de evento del webhook
    logWebhookParsed(
      webhookData.account,
      webhookData.message?.add?.[0],
      webhookData.talk?.add?.[0],
      webhookData.leads,
      webhookData.talk?.update?.[0],
      webhookData.unsorted?.add?.[0],
      webhookData.leads?.delete?.[0],
      webhookData.unsorted?.delete?.[0]
    );

    // instanciamos los objetos de los eventos del webhook
    const unsortedAdd = webhookData.unsorted?.add?.[0];
    const talkAdd = webhookData.talk?.add?.[0];
    const talkUpdate = webhookData.talk?.update?.[0];
    const incomingMessage = webhookData.message?.add?.[0]?.type === "incoming";
    const incomingMessageData = webhookData.message?.add?.[0];

    // Process unsorted add (create lead and user)
    if (unsortedAdd) {
      try {
        // Adapter unsorted add to create user
        const adaptedUser = adapterUnsortedAddToCreateUser(unsortedAdd);
        const adaptedLead = adapterUnsortedAddToCreateLead(unsortedAdd);

        // Create user
        const userCreated = await createUser(adaptedUser);
        logger.info(`💾 Usuario creado:`, userCreated);

        // Create lead
        const leadCreated = await createLead(adaptedLead);
        logger.info(`💾 Lead creado:`, leadCreated);

        // Procesar código para Meta si existe en el message_text
        const messageText = unsortedAdd.source_data?.data?.[0]?.text || "";
        logger.info(`🔍 Message text:`, messageText);

        // Process conversion to Meta if message text is not empty
        if (messageText.trim() !== "") {
          const extractedCode = extractCodeFromMessage(messageText);
          if (extractedCode) {
            try {
              // Buscar el token en la base de datos
              const tokenVisit = await findTokenVisit(extractedCode);
              if (tokenVisit) {
                // Verificar si ya se envió una conversión para este código y tipo de evento en los últimos 30 minutos
                const conversionAlreadySent = await isConversionAlreadySent(
                  extractedCode,
                  META_CONFIG.event1
                );
                if (conversionAlreadySent) {
                  return NextResponse.json({
                    success: true,
                    processed: false,
                    message: `Conversión ya enviada para código ${extractedCode}`,
                    duplicate_conversion: true,
                  });
                }

                // Enviar conversión a Meta API
                const metaAccessToken = META_CONFIG.accessToken;
                if (!metaAccessToken) {
                  console.error("❌ META_ACCESS_TOKEN no configurado");
                  return NextResponse.json({
                    success: false,
                    processed: false,
                    message: "META_ACCESS_TOKEN no configurado",
                  });
                }

                const conversionResult = await sendConversionToMeta(
                  {
                    ...tokenVisit.lead,
                    extractedCode: extractedCode,
                    eventName: META_CONFIG.event1,
                  },
                  metaAccessToken
                );

                // Verificar si la conversión se envió exitosamente
                if (!conversionResult.success) {
                  logConversionError(conversionResult, extractedCode);
                }

                // Preparar datos para guardar en send_meta
                const conversionData = {
                  data: [
                    {
                      event_name: META_CONFIG.event1,
                      event_time: Math.floor(Date.now() / 1000),
                      action_source: "website",
                      event_source_url:
                        tokenVisit.lead.eventSourceUrl ||
                        "https://kommo-ai-integration.vercel.app/",
                      user_data: {
                        client_ip_address: tokenVisit.lead.ip
                          ? tokenVisit.lead.ip
                          : undefined,
                        client_user_agent: tokenVisit.lead.userAgent
                          ? tokenVisit.lead.userAgent
                          : undefined,
                        fbp: tokenVisit.lead.fbp
                          ? tokenVisit.lead.fbp
                          : undefined,
                        fbc: tokenVisit.lead.fbc
                          ? tokenVisit.lead.fbc
                          : undefined,
                      },
                    },
                  ],
                };

                // Adaptar datos para guardar en send_meta
                const adaptedConversionData = adapterConversionData(
                  conversionData,
                  messageText
                );

                // Guardar registro en send_meta
                const saveResult = await saveSendMetaRecord(
                  [conversionData],
                  adaptedConversionData,
                  extractedCode,
                  [conversionResult]
                );

                logger.info(`💾 Registro guardado en send_meta:`, saveResult);

                if (conversionResult.success) {
                  // Sincronizar lead y contacto desde API de Kommo si no existen localmente
                  const leadId = unsortedAdd.lead_id;
                  const contactId = unsortedAdd.data?.contacts?.[0]?.id;
                  if (leadId && contactId) {
                    await syncLeadAndContactFromKommoApi(leadId, contactId);
                  }
                } else {
                  logger.error(
                    `❌ Error al enviar conversión para unsorted add con código ${extractedCode}:`,
                    conversionResult.error
                  );
                }
              } else {
                logger.error(
                  `⚠️ Código no encontrado en base de datos para unsorted add: ${extractedCode}`
                );
              }
            } catch (error) {
              logger.error(
                `❌ Error al procesar código ${extractedCode} en unsorted add:`,
                error
              );
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
        });
      } catch (error) {
        logWebhookError(error, "procesando unsorted add");
        return NextResponse.json(
          {
            success: false,
            processed: false,
            error: "Error creando lead/usuario",
            details:
              error instanceof Error ? error.message : "Error desconocido",
          },
          { status: 500 }
        );
      }
    }

    // Process talk add (create task)
    if (talkAdd) {
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
          createdAt: talkAdd.created_at,
        });

        return NextResponse.json({
          success: true,
          processed: true,
          type: "talk_add",
          talk_id: talkAdd.talk_id,
          message: "Conversación creada correctamente",
        });
      } catch (error) {
        logWebhookError(error, "procesando talk add");
        return NextResponse.json(
          {
            success: false,
            processed: false,
            error: "Error creando conversación",
            details:
              error instanceof Error ? error.message : "Error desconocido",
          },
          { status: 500 }
        );
      }
    }

    // Process talk update (update task)
    if (talkUpdate) {
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
          updatedAt: talkUpdate.updated_at,
        });

        return NextResponse.json({
          success: true,
          processed: true,
          type: "talk_update",
          talk_id: talkUpdate.talk_id,
          message: "Conversación actualizada correctamente",
        });
      } catch (error) {
        logWebhookError(error, "procesando talk update");
        return NextResponse.json(
          {
            success: false,
            processed: false,
            error: "Error actualizando conversación",
            details:
              error instanceof Error ? error.message : "Error desconocido",
          },
          { status: 500 }
        );
      }
    }

    // Process only incoming messages
    if (incomingMessage && incomingMessageData) {
      const message = incomingMessageData;

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
          attachment: message.attachment,
        });

        // Solo procesar con IA si el mensaje se guardó correctamente en la DB

        // VALIDAR QUE EL MENSAJE NO SEA DUPLICADO POR TEXTO ANTES DE PROCESAR CON IA
        const alreadyProcessedByMessageText = await checkExistingMessageText(
          message.text,
          message.entity_id,
          message.created_at
        );

        if (alreadyProcessedByMessageText) {
          console.log(
            `⚠️ Mensaje ya procesado anteriormente (message.text: "${message.text}") - saltando todo el procesamiento`
          );
          return NextResponse.json({
            success: true,
            message:
              "Mensaje ya procesado anteriormente por texto - no reprocesado",
            messageText: message.text,
            skipped: true,
            duplicate_reason: "message_text_already_processed",
          });
        }

        // Validar si el mensaje contiene un código
        const extractedCode = extractCodeFromMessage(message.text);
        if (extractedCode) {
          try {
            // Buscar el token en la base de datos
            const tokenVisit = await findTokenVisit(extractedCode);

            if (tokenVisit) {
              console.log(`✅ Token encontrado:`, tokenVisit);

              // Verificar si ya se envió una conversión para este código y tipo de evento en los últimos 30 minutos
              const conversionAlreadySent = await isConversionAlreadySent(
                extractedCode,
                META_CONFIG.event1
              );
              if (conversionAlreadySent) {
                console.log(
                  `⚠️ Conversión ya enviada para código ${extractedCode} en los últimos 30 minutos - omitiendo envío duplicado`
                );
                // Continuar con el procesamiento del mensaje (no retornar aquí)
              } else {
                // Enviar conversión a Meta API
                const metaAccessToken = META_CONFIG.accessToken;
                if (!metaAccessToken) {
                  console.error("❌ META_ACCESS_TOKEN no configurado");
                  return NextResponse.json({
                    success: false,
                    processed: false,
                    message: "META_ACCESS_TOKEN no configurado",
                  });
                }
                const conversionResult = await sendConversionToMeta(
                  {
                    ...tokenVisit.lead,
                    extractedCode: extractedCode,
                    eventName: META_CONFIG.event1,
                  },
                  metaAccessToken
                );

                // Preparar datos para guardar en send_meta
                const conversionData = {
                  data: [
                    {
                      event_name: META_CONFIG.event1,
                      event_time: Math.floor(Date.now() / 1000),
                      action_source: "website",
                      event_source_url:
                        tokenVisit.lead.eventSourceUrl ||
                        "https://kommo-ai-integration.vercel.app",
                      user_data: {
                        client_ip_address: tokenVisit.lead.ip
                          ? tokenVisit.lead.ip
                          : undefined,
                        client_user_agent: tokenVisit.lead.userAgent
                          ? tokenVisit.lead.userAgent
                          : undefined,
                        fbp: tokenVisit.lead.fbp
                          ? tokenVisit.lead.fbp
                          : undefined,
                        fbc: tokenVisit.lead.fbc
                          ? tokenVisit.lead.fbc
                          : undefined,
                      },
                    },
                  ],
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
                  console.log(
                    `💾 Registro guardado en send_meta para código: ${extractedCode}`
                  );
                } else {
                  console.error(
                    `❌ Error al guardar en send_meta para código ${extractedCode}:`,
                    saveResult.error
                  );
                }

                if (conversionResult.success) {
                  console.log(
                    `🎉 Conversión enviada exitosamente para código: ${extractedCode}`
                  );

                  // Sincronizar lead y contacto desde API de Kommo si no existen localmente
                  await syncLeadAndContactFromKommoApi(
                    message.entity_id,
                    message.contact_id
                  );
                } else {
                  console.error(
                    `❌ Error al enviar conversión para código ${extractedCode}:`,
                    conversionResult.error
                  );
                }
              }
            } else {
              console.log(
                `⚠️ Código no encontrado en base de datos: ${extractedCode}`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error al procesar código ${extractedCode}:`,
              error
            );
          }
        }

        if (message.talk_id && message.entity_id) {
          // Verificar si el mensaje ya fue procesado por la IA para evitar reprocesamiento
          const alreadyProcessed = await isMessageAlreadyProcessed(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text
          );

          if (alreadyProcessed) {
            logMessageSkipped(
              `Mensaje ya procesado anteriormente - ignorando reprocesamiento: ${message.id}`
            );
            return NextResponse.json({
              success: true,
              processed: false,
              message: "Mensaje ya procesado anteriormente - no reprocesado",
              duplicate: true,
            });
          }

          logMessageProcessing(
            message.text,
            message.author?.name || "Cliente",
            message.talk_id,
            message.entity_id,
            message.attachment
          );

          // Obtener la configuración de Kommo
          const config: KommoApiConfig = {
            subdomain: KOMMO_CONFIG.subdomain || "",
          };

          if (!config.subdomain) {
            logConfigWarning(
              "Configuración de Kommo incompleta - no se puede procesar el lead"
            );
            return NextResponse.json({
              success: false,
              processed: false,
              message: "Configuración de Kommo incompleta",
            });
          }

          // Obtener el status actual del lead desde Kommo
          logLeadStatusQuery(message.entity_id);
          const currentStatus = await getCurrentLeadStatus(
            message.entity_id,
            config
          );

          // Usar 'sin-status' si no se puede obtener el status actual
          const effectiveStatus = currentStatus || "sin-status";

          if (!currentStatus) {
            logConfigWarning(
              `No se pudo obtener el status actual del lead ${message.entity_id}, usando 'sin-status'`
            );
          } else {
            logLeadStatusRetrieved(message.entity_id, currentStatus, "");
          }

          // Obtener contexto histórico del contacto (últimas 24 horas)
          let contactContext;
          try {
            contactContext = await getContactContext(message.contact_id);
          } catch (contextError) {
            logWebhookError(
              contextError,
              "obteniendo contexto histórico del contacto"
            );
            // Continuar sin contexto si hay error
          }

          let simplifiedRules: Array<{ priority: number; rule: string }> = [];
          try {
            simplifiedRules = await getActiveRulesForAI();
            console.log("📋 Reglas normalizadas para AI:", simplifiedRules);
          } catch (rulesError) {
            logWebhookError(rulesError, "obteniendo reglas generales");
            // Continuar sin reglas si hay error (array vacío)
          }

          let settings: SettingsDocument | null = null;
          try {
            settings = await getSettingsById(
              KOMMO_CONFIG.pipelines[0].settings.id || ""
            );
            console.log(
              "KOMMO_CONFIG.pipelines[0].settings.id:",
              KOMMO_CONFIG.pipelines[0].settings.id
            );
          } catch (settingsError) {
            logWebhookError(settingsError, "obteniendo settings");
          }

          let statuses: StatusDocument[] | null = null;
          try {
            statuses = await getAllStatus();
          } catch (statusesError) {
            logWebhookError(statusesError, "obteniendo statuses");
          }

          // VALIDAR QUE EL MENSAJE NO SEA DUPLICADO ANTES DE PROCESAR CON IA
          const validationResult = await validateWebhookForProcessing(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text,
            message.type,
            message.element_type
          );

          if (!validationResult.shouldProcess) {
            // Loggear mensaje duplicado y saltar procesamiento
            logDuplicateMessageSkipped(
              message.talk_id,
              message.entity_id,
              message.contact_id,
              message.text,
              validationResult.reason || "Sin razón especificada",
              validationResult.duplicateInfo?.type || "message",
              validationResult.duplicateInfo?.lastProcessedAt
            );

            // Loggear spam si fue detectado
            if (validationResult.duplicateInfo?.type === "event") {
              logSpamDetected(message.contact_id, 2, 5); // Asumiendo 2 mensajes en 5 minutos
            }

            // Continuar con el flujo pero sin procesar IA
            logMessageSkipped(
              `Mensaje duplicado saltado: ${validationResult.reason}`
            );
            return NextResponse.json({
              success: true,
              message: "Mensaje duplicado detectado y saltado",
              duplicate: true,
              reason: validationResult.reason,
            });
          }

          // Loggear que la validación pasó
          logWebhookValidationPassed(
            message.talk_id,
            message.entity_id,
            message.contact_id,
            message.text
          );

          // Process with AI usando el status efectivo, contexto histórico y reglas simplificadas
          aiDecision = await processMessageWithAI(
            message.text,
            effectiveStatus,
            message.talk_id,
            contactContext,
            simplifiedRules,
            settings,
            statuses,
            message.attachment
          );

          // Crear solicitud de pago si existe attachment
          if (aiDecision.newStatus === "RevisarImagen") {
            console.log(`💰 Creando solicitud de pago para attachment: ${message.attachment?.link}`);
            const paymentRequest = await createPaymentRequest({
              leadId: message.entity_id,
              contactId: message.contact_id,
              talkId: message.talk_id,
              attachment: {
                type: message.attachment?.type || "",
                link: message.attachment?.link as string || "",
                file_name: message.attachment?.file_name || "",
              },
            });
            console.log("Creada solicitud de pago con id: ", paymentRequest._id);
          } else {
            logger.info(`💰 No se creó solicitud de pago para attachment: ${message.attachment?.link}`);
          }

          logAiDecision(aiDecision, message.talk_id, message.entity_id);

          if (aiDecision.shouldChange) {
            logStatusChange(
              aiDecision.currentStatus,
              aiDecision.newStatus,
              aiDecision.reasoning,
              message.talk_id,
              message.entity_id
            );

            try {
              const updateSuccess = await updateLeadStatusByName(
                message.entity_id,
                aiDecision.newStatus as keyof typeof STATUS_MAPPING,
                config
              );

              if (updateSuccess) {
                logLeadUpdateSuccess(message.entity_id, aiDecision.newStatus);
              } else {
                logLeadUpdateError(message.entity_id, aiDecision.newStatus);
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
                });
              } catch (botActionError) {
                logWebhookError(
                  botActionError,
                  "registrando acción del bot en base de datos"
                );
                // No lanzamos error aquí para no cortar el flujo principal
              }
            } catch (updateError) {
              logLeadUpdateError(
                message.entity_id,
                aiDecision.newStatus,
                updateError
              );

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
                    error:
                      updateError instanceof Error
                        ? updateError.message
                        : "Error desconocido",
                  },
                });
              } catch (botActionError) {
                logWebhookError(
                  botActionError,
                  "registrando acción del bot con error en base de datos"
                );
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
              });
            } catch (botActionError) {
              logWebhookError(
                botActionError,
                "registrando acción del bot sin cambio en base de datos"
              );
              // No lanzamos error aquí para no cortar el flujo principal
            }
          }

          return NextResponse.json({
            success: true,
            processed: true,
            decision: aiDecision,
            currentStatus,
            message: "Mensaje procesado correctamente",
          });
        }
      } catch (error) {
        logWebhookError(error, "guardando mensaje en base de datos");
        // Si falla el guardado en DB, no se procesa con IA
        return NextResponse.json(
          {
            success: false,
            processed: false,
            message:
              "Error al guardar mensaje en base de datos - no se procesó con IA",
            error: error instanceof Error ? error.message : "Error desconocido",
          },
          { status: 500 }
        );
      }
    }

    // For non-message webhooks or outgoing messages
    return NextResponse.json({
      success: true,
      processed: false,
      message: "Webhook recibido pero no procesado (no es mensaje entrante)",
    });
  } catch (error) {
    logWebhookError(error);
    return NextResponse.json(
      {
        success: false,
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
